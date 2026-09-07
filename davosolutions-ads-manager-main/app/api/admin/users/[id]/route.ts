import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { requireSuperAdmin, writeAudit } from "@/lib/server-auth";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireSuperAdmin(request);
    const body = await request.json();
    const { id } = await params;
    if (id === admin.id) {
      return NextResponse.json({ error: "Cannot modify your own account status." }, { status: 400 });
    }

    const updates: { displayName?: string; email?: string; active?: boolean; password?: string } = {};
    if (typeof body.displayName === "string" && body.displayName.trim()) {
      updates.displayName = body.displayName.trim();
    }
    if (typeof body.email === "string" && body.email.trim()) {
      const email = body.email.trim().toLowerCase();
      if (!/^\S+@\S+\.\S+$/.test(email)) {
        return NextResponse.json({ error: "Use a valid email address." }, { status: 400 });
      }
      updates.email = email;
    }
    if (typeof body.active === "boolean") {
      updates.active = body.active;
    }
    if (typeof body.password === "string" && body.password.length >= 8) {
      updates.password = body.password;
    } else if (typeof body.password === "string" && body.password.length > 0) {
      return NextResponse.json({ error: "Password must be at least 8 characters." }, { status: 400 });
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ ok: true }); // nothing to update
    }

    const auth = getAdminAuth();
    const db = getAdminDb();
    const target = await db.collection("users").doc(id).get();
    if (!target.exists) return NextResponse.json({ error: "User not found." }, { status: 404 });
    const previousEmail = String(target.data()?.email || "").toLowerCase();
    
    // Update Firebase Auth if needed
    const authUpdates: any = {};
    if (updates.password) authUpdates.password = updates.password;
    if (updates.displayName) authUpdates.displayName = updates.displayName;
    if (updates.email) authUpdates.email = updates.email;
    if (updates.active !== undefined) authUpdates.disabled = !updates.active;
    
    if (Object.keys(authUpdates).length > 0) {
      await auth.updateUser(id, authUpdates);
    }

    // Update Firestore
    const dbUpdates: any = { updatedAt: Date.now() };
    if (updates.displayName) dbUpdates.displayName = updates.displayName;
    if (updates.email) dbUpdates.email = updates.email;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    
    const batch = db.batch();
    batch.update(db.collection("users").doc(id), dbUpdates);
    if (updates.email && updates.email !== previousEmail) {
      batch.set(db.collection("whitelistedUsers").doc(updates.email), { addedAt: Date.now(), addedBy: admin.id, updatedAt: Date.now() });
      if (previousEmail) batch.delete(db.collection("whitelistedUsers").doc(previousEmail));
    }
    await batch.commit();
    
    // Audit
    await writeAudit({
      workspaceId: admin.workspaceId,
      actorId: admin.id,
      actorEmail: admin.email,
      action: "user_updated",
      entityType: "user",
      entityId: id,
      entityLabel: updates.displayName || id,
      details: updates
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Could not update user." }, { status: 400 });
  }
}
