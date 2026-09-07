export const SESSION_COOKIE_NAME = "davo_session";
export const SESSION_DURATION_MS = 5 * 24 * 60 * 60 * 1000;
export const RECENT_SIGN_IN_SECONDS = 5 * 60;

export function isRecentSignIn(authTimeSeconds: number, nowSeconds = Math.floor(Date.now() / 1000)): boolean {
  return Number.isFinite(authTimeSeconds) && authTimeSeconds <= nowSeconds + 30 && nowSeconds - authTimeSeconds <= RECENT_SIGN_IN_SECONDS;
}

/** Origin is mandatory. Never trust Host/X-Forwarded-Host as the allowlist. */
export function isSameOriginRequest(origin: string | null, allowedOrigin: string): boolean {
  if (!origin || origin === "null") return false;
  return origin === allowedOrigin;
}
