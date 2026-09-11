import "server-only";

import { getAppOrigin } from "../firebase/admin";
import { isSameOriginRequest } from "../auth/session-policy";

export class RequestError extends Error {
  constructor(public readonly status: number, message: string) { super(message); this.name = "RequestError"; }
}

export function assertSameOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const appOrigin = getAppOrigin();
  if (isSameOriginRequest(origin, appOrigin)) return;

  // Allow LAN origin for mobile testing on local network
  const lanUrl = process.env.LAN_URL;
  if (lanUrl && origin === new URL(lanUrl).origin) return;

  throw new RequestError(403, "Request origin is not allowed.");
}

export async function readJsonBody(request: Request, maxBytes = 16_384): Promise<unknown> {
  if (request.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() !== "application/json") {
    throw new RequestError(415, "Expected application/json.");
  }
  if (!request.body) throw new RequestError(400, "A JSON body is required.");
  const reader = request.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let size = 0;
  let body = "";
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new RequestError(413, "Request body is too large."); }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
    return JSON.parse(body) as unknown;
  } catch (error) {
    if (error instanceof RequestError) throw error;
    throw new RequestError(400, "Invalid JSON body.");
  } finally { reader.releaseLock(); }
}
