import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb, getAdminAuth } from "../../firebase/admin";
import {
  userProfileSchema,
  type UserProfile,
  type Role,
  type UserStatus,
  type OperationalPermissions,
} from "../../auth/model";
import type { AuditEvent } from "../audit-model";
import { appendAuditInTransaction } from "../audit";

const USERS_COLLECTION = "users";

function docToUserProfile(uid: string, data: FirebaseFirestore.DocumentData): UserProfile {
  return userProfileSchema.parse({ ...data, uid });
}

/** List all users. Super Admin only. */
export async function listUsers(): Promise<UserProfile[]> {
  const db = getAdminDb();
  const snapshot = await db.collection(USERS_COLLECTION).get();
  return snapshot.docs.map((doc) => docToUserProfile(doc.id, doc.data()));
}

/** Get a single user by UID. */
export async function getUserById(uid: string): Promise<UserProfile | null> {
  if (!uid || uid.includes("/")) return null;
  const db = getAdminDb();
  const snapshot = await db.collection(USERS_COLLECTION).doc(uid).get();
  if (!snapshot.exists) return null;
  return docToUserProfile(snapshot.id, snapshot.data()!);
}

/** Count currently active super admins. Used for last-admin protection. */
export async function countActiveSuperAdmins(): Promise<number> {
  const db = getAdminDb();
  const snapshot = await db
    .collection(USERS_COLLECTION)
    .where("role", "==", "super_admin")
    .where("status", "==", "active")
    .get();
  return snapshot.size;
}

/**
 * Create a new user: Firebase Auth account + Firestore profile.
 * 
 * Firebase Auth and Firestore are NOT transactional together.
 * Strategy: Create Auth user first, then write Firestore profile.
 * If Firestore write fails, we attempt to clean up the Auth user.
 */
export async function createUser(input: {
  email: string;
  name: string;
  password: string;
  role: Role;
  permissions: OperationalPermissions;
  createdByUid: string;
  createdByRole: Role;
}): Promise<UserProfile> {
  const auth = getAdminAuth();
  const db = getAdminDb();

  // 1. Create Firebase Auth user
  let authUser;
  try {
    authUser = await auth.createUser({
      email: input.email,
      password: input.password,
      displayName: input.name,
    });
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "auth/email-already-exists") {
      throw new Error("A user with this email already exists.");
    }
    throw new Error("Failed to create user account.");
  }

  const uid = authUser.uid;
  const permissions = input.role === "super_admin"
    ? { viewSalaries: true, viewTransport: true, viewBills: true, viewOperationalTotals: true }
    : input.permissions;

  const profile: Omit<UserProfile, "uid"> = {
    name: input.name,
    email: input.email,
    role: input.role,
    status: "active",
    permissions,
  };

  // 2. Write Firestore profile + audit in a transaction
  try {
    await db.runTransaction(async (transaction) => {
      const userRef = db.collection(USERS_COLLECTION).doc(uid);
      transaction.set(userRef, {
        ...profile,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      const auditEvent: AuditEvent = {
        action: "user.invite",
        actor: { uid: input.createdByUid, role: input.createdByRole },
        target: { collection: USERS_COLLECTION, id: uid },
        after: { ...profile, uid },
        reason: `Invited user ${input.name} (${input.email}) as ${input.role}`,
      };
      appendAuditInTransaction(transaction, auditEvent);
    });
  } catch (error) {
    // Compensate: remove the Auth user if Firestore write failed
    try { await auth.deleteUser(uid);  } catch (_cleanupErr) { /* best-effort cleanup */ }
    throw new Error("Failed to complete user creation. Auth user was cleaned up.");
  }

  return { uid, ...profile };
}

/**
 * Update a user's role, status, or permissions.
 * Handles last-admin protection and session revocation.
 */
export async function updateUser(
  targetUid: string,
  updates: {
    role?: Role;
    status?: UserStatus;
    name?: string;
    permissions?: OperationalPermissions;
  },
  actor: { uid: string; role: Role },
  reason: string,
): Promise<UserProfile> {
  const db = getAdminDb();
  const auth = getAdminAuth();

  return db.runTransaction(async (transaction) => {
    const userRef = db.collection(USERS_COLLECTION).doc(targetUid);
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) throw new Error("User not found.");

    const current = docToUserProfile(snapshot.id, snapshot.data()!);

    // Last-admin protection: if demoting or deactivating a super_admin
    const isDemoting = current.role === "super_admin" && updates.role && updates.role !== "super_admin";
    const isDeactivating = current.status === "active" && updates.status === "deactivated";

    if ((isDemoting || isDeactivating) && current.role === "super_admin") {
      const adminCount = await countActiveSuperAdmins();
      if (adminCount <= 1) {
        throw new Error("Cannot remove the last active Super Admin. Promote another user first.");
      }
    }

    // If changing to super_admin, grant full permissions
    const newRole = updates.role ?? current.role;
    let newPermissions = updates.permissions ?? current.permissions;
    if (newRole === "super_admin") {
      newPermissions = { viewSalaries: true, viewTransport: true, viewBills: true, viewOperationalTotals: true };
    }

    const updateData: Record<string, unknown> = {
      updatedAt: FieldValue.serverTimestamp(),
    };
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.role !== undefined) updateData.role = updates.role;
    if (updates.status !== undefined) updateData.status = updates.status;
    updateData.permissions = newPermissions;

    transaction.update(userRef, updateData);

    const after = {
      uid: targetUid,
      name: updates.name ?? current.name,
      email: current.email,
      role: newRole,
      status: updates.status ?? current.status,
      permissions: newPermissions,
    };

    const auditEvent: AuditEvent = {
      action: updates.role && updates.role !== current.role ? "user.role_change" : "user.update",
      actor: { uid: actor.uid, role: actor.role },
      target: { collection: USERS_COLLECTION, id: targetUid },
      before: current as unknown as Record<string, unknown>,
      after: after as unknown as Record<string, unknown>,
      reason,
    };
    appendAuditInTransaction(transaction, auditEvent);

    // Revoke sessions if deactivated or role changed
    const needsRevocation = isDeactivating || isDemoting;
    if (needsRevocation) {
      // This runs outside the transaction since Auth is not transactional with Firestore.
      // We do it after the transaction commits by scheduling it.
      // For now, we'll handle it post-transaction below.
    }

    return after as UserProfile;
  }).then(async (updatedUser) => {
    // Post-transaction: revoke tokens if needed
    const isDemoting = updates.role && updates.role !== "super_admin" && updatedUser.role !== "super_admin";
    const isDeactivating = updates.status === "deactivated";
    if (isDemoting || isDeactivating) {
      try { await auth.revokeRefreshTokens(targetUid); } catch { /* best-effort */ }
    }
    return updatedUser;
  });
}
