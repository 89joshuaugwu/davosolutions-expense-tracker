import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser, AuthenticationError, AuthorizationError } from "@/lib/auth/session";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { assertSameOrigin, readJsonBody, RequestError } from "@/lib/server/request";
import { getExpenseById } from "@/lib/server/repositories/expenses";
import { correctExpenseSchema, archiveExpenseSchema } from "@/features/expenses/schema";
import { correctExpense, archiveExpense, ExpenseServiceError } from "@/features/expenses/service";
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
  console.error("[expense-detail-api]", error instanceof Error ? error.message : "Unknown error");
  return json({ error: "An unexpected error occurred." }, 500);
}

function extractSessionCookie(request: Request): string | undefined {
  return request.headers
    .get("cookie")
    ?.split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`))
    ?.slice(SESSION_COOKIE_NAME.length + 1);
}

/**
 * GET /api/expenses/[id] — Authorized expense detail.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await getSessionUser(extractSessionCookie(request));
    const expense = await getExpenseById(id, user.uid, isSuperAdmin(user));
    if (!expense) return json({ error: "Expense not found." }, 404);
    return json({ expense });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * PATCH /api/expenses/[id] — Super Admin correction.
 * Requires reason and matching expected revision.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const body = await readJsonBody(request);
    const input = correctExpenseSchema.parse(body);
    await correctExpense(extractSessionCookie(request), id, input);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}

/**
 * DELETE /api/expenses/[id] — Super Admin soft-archive.
 * Archived expenses are excluded from aggregates but remain recoverable and auditable.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    assertSameOrigin(request);
    const { id } = await params;
    const body = await readJsonBody(request);
    const input = archiveExpenseSchema.parse(body);
    await archiveExpense(extractSessionCookie(request), id, input);
    return json({ ok: true });
  } catch (error) {
    return errorResponse(error);
  }
}
