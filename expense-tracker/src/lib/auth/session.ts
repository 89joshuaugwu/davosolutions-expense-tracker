import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ConfigurationError, getAdminAuth, getAdminDb } from "../firebase/admin";
import { userProfileSchema, type UserProfile } from "./model";
import { isSuperAdmin } from "./permissions";
import { SESSION_COOKIE_NAME } from "./session-policy";

export class AuthenticationError extends Error {
  constructor() { super("Authentication required."); this.name = "AuthenticationError"; }
}

export class AuthorizationError extends Error {
  constructor() { super("Access denied."); this.name = "AuthorizationError"; }
}

/** Never trust a role in a cookie/custom claim: read the current profile on every operation. */
export async function loadActiveUser(uid: string): Promise<UserProfile> {
  const snapshot = await getAdminDb().collection("users").doc(uid).get();
  const parsed = userProfileSchema.safeParse({ ...snapshot.data(), uid });
  if (!snapshot.exists || !parsed.success || parsed.data.status !== "active") throw new AuthorizationError();
  return parsed.data;
}

/** API/service entry point: throws typed errors, never redirects or caches authorization. */
export async function getSessionUser(sessionCookie?: string): Promise<UserProfile> {
  const value = sessionCookie ?? (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (!value) throw new AuthenticationError();
  let uid: string;
  try { uid = (await getAdminAuth().verifySessionCookie(value, true)).uid; }
  catch (error) {
    if (error instanceof ConfigurationError) throw error;
    throw new AuthenticationError();
  }
  return loadActiveUser(uid);
}

/** Page wrapper only. Services/route handlers should call getSessionUser directly. */
export async function requireUser(): Promise<UserProfile> {
  try { return await getSessionUser(); }
  catch (error) {
    if (error instanceof ConfigurationError) redirect("/login?setup=required");
    if (error instanceof AuthenticationError) redirect("/login");
    if (error instanceof AuthorizationError) redirect("/login?access=denied");
    throw error;
  }
}

export async function requireSuperAdmin(): Promise<UserProfile> {
  const user = await requireUser();
  if (!isSuperAdmin(user)) redirect("/dashboard?access=denied");
  return user;
}
