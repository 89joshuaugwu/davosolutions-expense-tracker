import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, AuthenticationError, AuthorizationError } from "@/lib/auth/session";
import { isSuperAdmin, canCreateOperationalRecord } from "@/lib/auth/permissions";
import { assertSameOrigin, readJsonBody, RequestError } from "@/lib/server/request";
import { listExpenses } from "@/lib/server/repositories/expenses";
import { createExpenseSchema } from "@/features/expenses/schema";
import { createExpense, ExpenseServiceError } from "@/features/expenses/service";
import { getActiveCategories } from "@/lib/server/repositories/categories";
import { getOrCreateDefaultSettings } from "@/lib/server/repositories/settings";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-policy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function json(body: Record<string, unknown>, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function errorResponse(error: unknown) {
  if (error instanceof ExpenseServiceError) return json({ error: error.message, code: error.code }, error.status);
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
  // Fail closed for unknown errors; never serialize raw SDK errors
  console.error("[expense-api]", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "An unexpected error occurred." }, 500);
}

/**
 * POST /api/expenses — Create a new general expense.
 * Requires active operational access. All money is computed server-side.
 */
export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const body = await readJsonBody(request);
    const input = createExpenseSchema.parse(body);

    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const result = await createExpense(sessionCookie, input);
    return json({ ok: true, id: result.id, baseAmountMinor: result.baseAmountMinor, baseCurrency: result.baseCurrency }, 201);
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * GET /api/expenses — List expenses for the authenticated user.
 * Super Admin sees all; Secretary sees own + explicitly assigned records.
 */
export async function GET(request: Request) {
  try {
    const cookie = request.headers.get("cookie");
    const sessionCookie = cookie
      ?.split(";")
      .map((c) => c.trim())
      .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
      ?.slice(SESSION_COOKIE_NAME.length + 1);

    const user = await getSessionUser(sessionCookie);
    if (!canCreateOperationalRecord(user)) throw new AuthorizationError();

    const url = new URL(request.url);
    const month = url.searchParams.get("month") ?? undefined;
    const cursor = url.searchParams.get("cursor") ?? undefined;

    // Also load categories and settings for the UI to render properly
    const [expensesResult, categories, settings] = await Promise.all([
      listExpenses({
        uid: user.uid,
        isSuperAdmin: isSuperAdmin(user),
        month,
        cursor,
        pageSize: 20,
      }),
      getActiveCategories(),
      getOrCreateDefaultSettings(),
    ]);

    return json({
      items: expensesResult.items,
      nextCursor: expensesResult.nextCursor,
      categories,
      baseCurrency: settings.baseCurrency,
    });
  } catch (error) {
    return errorResponse(error);
  }
}
