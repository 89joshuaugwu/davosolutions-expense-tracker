import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError, AuthorizationError, getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { assertSameOrigin, readJsonBody, RequestError } from "@/lib/server/request";
import { correctRevenueSchema, archiveRevenueSchema } from "@/features/revenue/schema";
import { RevenueService, RevenueServiceError } from "@/features/revenue/service";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-policy";
import { getRevenueById } from "@/lib/server/repositories/revenue";

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
  console.error("[revenue-[id]-api]", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "An unexpected error occurred." }, 500);
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const user = await getSessionUser(sessionCookie);
    if (!isSuperAdmin(user)) throw new AuthorizationError();

    const resolvedParams = await params;
    const record = await getRevenueById(resolvedParams.id);

    if (!record) {
      return json({ error: "Revenue record not found." }, 404);
    }

    return json({ item: record });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const input = correctRevenueSchema.parse(body);
    const resolvedParams = await params;

    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const service = new RevenueService();
    await service.correctRevenue(sessionCookie, resolvedParams.id, input);

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const input = archiveRevenueSchema.parse(body);
    const resolvedParams = await params;

    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const service = new RevenueService();
    await service.archiveRevenue(sessionCookie, resolvedParams.id, input);

    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
