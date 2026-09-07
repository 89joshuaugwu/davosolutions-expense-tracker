import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError, AuthorizationError, getSessionUser, loadActiveUser } from "@/lib/auth/session";
import { isRecentSignIn, SESSION_COOKIE_NAME, SESSION_DURATION_MS } from "@/lib/auth/session-policy";
import { ConfigurationError, getAdminAuth } from "@/lib/firebase/admin";
import { appendAudit } from "@/lib/server/audit";
import { assertSameOrigin, readJsonBody, RequestError } from "@/lib/server/request";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({ idToken: z.string().min(100).max(12_000) }).strict();
const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/" };

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorResponse(error: unknown) {
  if (error instanceof RequestError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) return json({ error: "Invalid request." }, 400);
  if (error instanceof AuthenticationError || error instanceof AuthorizationError) return json({ error: "Unable to authenticate this account." }, 401);
  // Configuration, upstream and audit failures fail closed; never serialize raw SDK errors.
  if (error instanceof ConfigurationError) return json({ error: "Login is unavailable until setup is complete." }, 503);
  return json({ error: "Authentication is temporarily unavailable." }, 503);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const { idToken } = bodySchema.parse(await readJsonBody(request));
    const auth = getAdminAuth();
    let decoded;
    try { decoded = await auth.verifyIdToken(idToken, true); }
    catch { throw new AuthenticationError(); }
    if (!isRecentSignIn(decoded.auth_time)) throw new AuthenticationError();
    let user;
    try { user = await loadActiveUser(decoded.uid); }
    catch (error) {
      if (error instanceof AuthorizationError) await appendAudit({
        action: "auth.login_denied", actor: { uid: decoded.uid, role: null }, target: { collection: "users", id: decoded.uid },
      });
      throw error;
    }
    const session = await auth.createSessionCookie(idToken, { expiresIn: SESSION_DURATION_MS });
    await appendAudit({ action: "auth.login", actor: { uid: user.uid, role: user.role }, target: { collection: "users", id: user.uid } });
    const response = json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, session, { ...cookieOptions, maxAge: SESSION_DURATION_MS / 1000 });
    return response;
  } catch (error) { return errorResponse(error); }
}

export async function DELETE(request: Request) {
  try {
    assertSameOrigin(request);
    try {
      const user = await getSessionUser();
      await appendAudit({ action: "auth.logout", actor: { uid: user.uid, role: user.role }, target: { collection: "users", id: user.uid } });
    } catch (error) {
      // Invalid/expired/deactivated sessions must still be removable.
      if (!(error instanceof AuthenticationError) && !(error instanceof AuthorizationError)) throw error;
    }
    const response = json({ ok: true });
    response.cookies.set(SESSION_COOKIE_NAME, "", { ...cookieOptions, maxAge: 0, expires: new Date(0) });
    return response;
  } catch (error) { return errorResponse(error); }
}
