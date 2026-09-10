import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/session";
import { assertSameOrigin, readJsonBody, RequestError } from "@/lib/server/request";
import { createRevenueSourceSchema } from "@/features/revenue/schema";
import { RevenueSourceService, RevenueServiceError } from "@/features/revenue/service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorResponse(error: unknown) {
  if (error instanceof RevenueServiceError) return json({ error: error.message, code: error.code }, error.status);
  if (error instanceof RequestError) return json({ error: error.message }, error.status);
  if (error instanceof z.ZodError) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of error.issues) {
      const key = issue.path.join(".");
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return json({ error: "Validation failed.", code: "VALIDATION_ERROR", fieldErrors }, 400);
  }
  if (error instanceof AuthenticationError) return json({ error: "Authentication required." }, 401);
  if (error instanceof AuthorizationError) return json({ error: "Access denied." }, 403);
  console.error("[revenue-sources-api]", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "An unexpected error occurred." }, 500);
}

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const service = new RevenueSourceService();
    const sources = await service.listSources(sessionCookie);

    return json({ items: sources });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const input = createRevenueSourceSchema.parse(body);

    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const service = new RevenueSourceService();
    const source = await service.createSource(sessionCookie, input);

    return json({ ok: true, id: source.id }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}
