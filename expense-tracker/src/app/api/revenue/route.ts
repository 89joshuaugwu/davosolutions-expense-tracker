import { NextResponse } from "next/server";
import { z } from "zod";
import { AuthenticationError, AuthorizationError } from "@/lib/auth/session";
import { assertSameOrigin, readJsonBody, RequestError } from "@/lib/server/request";
import { listRevenue } from "@/lib/server/repositories/revenue";
import { createRevenueSchema } from "@/features/revenue/schema";
import { RevenueService, RevenueServiceError } from "@/features/revenue/service";
import { getRevenueSources } from "@/lib/server/repositories/revenue-sources";
import { getOrCreateDefaultSettings } from "@/lib/server/repositories/settings";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-policy";
import { getSessionUser } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";

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
  console.error("[revenue-api]", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "An unexpected error occurred." }, 500);
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const input = createRevenueSchema.parse(body);

    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const service = new RevenueService();
    const result = await service.createRevenue(sessionCookie, input);
    return json({ ok: true, id: result.id, baseAmountMinor: result.baseAmountMinor, baseCurrency: result.baseCurrency }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const user = await getSessionUser(sessionCookie);
    if (!isSuperAdmin(user)) throw new AuthorizationError();

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? undefined;
    const startDate = url.searchParams.get("startDate") ?? undefined;
    const endDate = url.searchParams.get("endDate") ?? undefined;
    const sourceId = url.searchParams.get("sourceId") ?? undefined;
    const currency = url.searchParams.get("currency") ?? undefined;
    const createdBy = url.searchParams.get("createdBy") ?? undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;

    const [revenueResult, sources, settings] = await Promise.all([
      listRevenue({
        month,
        startDate,
        endDate,
        sourceId,
        currency,
        createdBy,
        cursor,
        pageSize: 20,
      }),
      getRevenueSources(true),
      getOrCreateDefaultSettings(),
    ]);

    return json({
      items: revenueResult.items,
      nextCursor: revenueResult.nextCursor,
      sources,
      baseCurrency: settings.baseCurrency,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
