import "server-only";

import { getAdminDb } from "../../lib/firebase/admin";
import { getSessionUser, AuthorizationError } from "../../lib/auth/session";
import { canCreateOperationalRecord, canCorrectOperationalRecord } from "../../lib/auth/permissions";
import { createMoneySnapshot, assertCurrency, type CurrencyCode, type MoneySnapshot } from "../../domain/money";
import { assertDateOnly, type DateOnly } from "../../domain/dates";
import type { ExpenseRecord } from "../../domain/models";
import type { AuditEvent } from "../../lib/server/audit-model";
import { getSettingsInTransaction, lockBaseCurrencyInTransaction } from "../../lib/server/repositories/settings";
import { getCategoryInTransaction } from "../../lib/server/repositories/categories";
import { getEffectiveRateInTransaction } from "../../lib/server/repositories/exchange-rates";
import { checkIdempotency } from "../../lib/server/repositories/idempotency";
import {
  createExpenseInTransaction,
  correctExpenseInTransaction,
  archiveExpenseInTransaction,
  getExpenseInTransaction,
} from "../../lib/server/repositories/expenses";
import { canonicalExpenseHash } from "./idempotency";
import type { CreateExpenseInput, CorrectExpenseInput, ArchiveExpenseInput } from "./schema";

export class ExpenseServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "ExpenseServiceError";
  }
}

/** Result of a successful expense creation. */
export interface CreateExpenseResult {
  readonly id: string;
  readonly baseAmountMinor: number;
  readonly baseCurrency: CurrencyCode;
}

/**
 * Creates a new general expense with atomic persistence of source, posting, audit, and
 * idempotency receipt. All monetary computations happen server-side from validated decimal
 * strings; client-supplied amounts/totals are never trusted.
 */
export async function createExpense(
  sessionCookie: string | undefined,
  input: CreateExpenseInput,
): Promise<CreateExpenseResult> {
  // 1. Authenticate and authorize
  const user = await getSessionUser(sessionCookie);
  if (!canCreateOperationalRecord(user)) throw new AuthorizationError();

  // 2. Idempotency check (outside transaction for early exit on duplicate)
  const hash = canonicalExpenseHash(input);
  const idempotencyCheck = await checkIdempotency(input.idempotencyKey, hash);
  if (idempotencyCheck.conflict) {
    throw new ExpenseServiceError("IDEMPOTENCY_CONFLICT", "This request conflicts with a previous submission.", 409);
  }
  if (idempotencyCheck.existing !== null) {
    // Return the previously created result without duplicating
    return { id: idempotencyCheck.existing, baseAmountMinor: 0, baseCurrency: "NGN" };
  }

  // 3. Validate date
  try {
    assertDateOnly(input.date as DateOnly);
  } catch {
    throw new ExpenseServiceError("INVALID_DATE", "The expense date is not a valid calendar day.");
  }

  // 4. Validate currency
  try {
    assertCurrency(input.currency);
  } catch {
    throw new ExpenseServiceError("INVALID_CURRENCY", "The selected currency is not supported.");
  }
  const currency = input.currency as CurrencyCode;

  // 5. Attachments are blocked until E4
  if (input.attachmentIds.length > 0) {
    throw new ExpenseServiceError("ATTACHMENTS_NOT_READY", "Attachment support is not yet available.");
  }

  // 6. Run the atomic transaction
  const db = getAdminDb();
  const result = await db.runTransaction(async (transaction) => {
    // --- All reads FIRST (Firestore requirement) ---
    const settings = await getSettingsInTransaction(transaction);
    if (!settings) {
      throw new ExpenseServiceError("SETTINGS_MISSING", "Company settings must be configured first.", 503);
    }

    // Verify currency is enabled
    if (!settings.enabledCurrencies.includes(currency)) {
      throw new ExpenseServiceError("CURRENCY_DISABLED", `${currency} is not enabled. Contact your administrator.`);
    }

    // Load active category
    const category = await getCategoryInTransaction(transaction, input.categoryId);
    if (!category) {
      throw new ExpenseServiceError("INVALID_CATEGORY", "The selected category does not exist or is archived.");
    }

    // Determine exchange rate
    const baseCurrency = settings.baseCurrency;
    let exchangeRate: string;
    let rateDate: DateOnly;

    if (currency === baseCurrency) {
      // Identity snapshot for base currency
      exchangeRate = "1";
      rateDate = input.date as DateOnly;
    } else {
      // Foreign currency requires a configured rate
      const rate = await getEffectiveRateInTransaction(transaction, currency, baseCurrency, input.date as DateOnly);
      if (!rate) {
        throw new ExpenseServiceError(
          "RATE_NOT_CONFIGURED",
          `No exchange rate is configured for ${currency} → ${baseCurrency}. Ask your Super Admin to set one.`,
        );
      }
      exchangeRate = rate.rate;
      rateDate = rate.effectiveFrom;
    }

    // --- All reads done; now compute and write ---

    // Server-side money computation (never trust client amounts)
    let snapshot: MoneySnapshot;
    try {
      snapshot = createMoneySnapshot({
        amount: input.amount,
        currency,
        baseCurrency,
        exchangeRate,
        rateDate,
      });
    } catch (error) {
      throw new ExpenseServiceError("INVALID_AMOUNT", error instanceof Error ? error.message : "Invalid amount.");
    }

    // Build the expense record (ID is assigned by repository)
    const expense: Omit<ExpenseRecord, "id" | "createdAt" | "updatedAt" | "revision"> = {
      kind: "expense",
      title: input.title,
      ...snapshot,
      categoryId: category.id,
      date: input.date as DateOnly,
      frequency: input.frequency,
      expenseKind: "general",
      notes: input.notes,
      attachments: [],
      visibleToUserIds: [],
      createdBy: user.uid,
      archivedAt: null,
      archivedBy: null,
    };

    // Build audit event (target ID is set after expense creation but record.create doesn't require before/after)
    const auditEvent: AuditEvent = {
      action: "record.create",
      actor: { uid: user.uid, role: user.role },
      target: { collection: "expenses", id: "pending" },
      after: {
        title: input.title,
        amount: input.amount,
        currency,
        baseCurrency,
        baseAmountMinor: snapshot.baseAmountMinor,
        date: input.date,
        categoryId: category.id,
        frequency: input.frequency,
      },
    };

    // Atomic write: expense + posting + audit + idempotency receipt
    // The repository generates the real expense ID and builds the ledger posting from it
    const expenseId = createExpenseInTransaction(
      transaction,
      expense,
      { snapshot, postedOn: input.date as DateOnly, categoryId: category.id },
      auditEvent,
      input.idempotencyKey,
      hash,
    );

    // Lock base currency after first monetary record
    lockBaseCurrencyInTransaction(transaction, settings);

    return {
      id: expenseId,
      baseAmountMinor: snapshot.baseAmountMinor,
      baseCurrency,
    };
  });

  return result;
}

/**
 * Applies a Super Admin correction to an existing expense.
 * Requires a reason and matching expected revision.
 */
export async function correctExpense(
  sessionCookie: string | undefined,
  expenseId: string,
  input: CorrectExpenseInput,
): Promise<void> {
  const user = await getSessionUser(sessionCookie);
  if (!canCorrectOperationalRecord(user)) throw new AuthorizationError();

  const db = getAdminDb();
  await db.runTransaction(async (transaction) => {
    const existing = await getExpenseInTransaction(transaction, expenseId);
    if (!existing) throw new ExpenseServiceError("NOT_FOUND", "Expense not found.", 404);
    if (existing.archivedAt !== null) throw new ExpenseServiceError("ARCHIVED", "Cannot correct an archived expense.");
    if (existing.revision !== input.expectedRevision) {
      throw new ExpenseServiceError("REVISION_CONFLICT", "This record was modified since you loaded it.", 409);
    }

    // Validate any date correction
    if (input.date) {
      try {
        assertDateOnly(input.date as DateOnly);
      } catch {
        throw new ExpenseServiceError("INVALID_DATE", "The corrected date is not a valid calendar day.");
      }
    }

    // Validate any category correction
    if (input.categoryId) {
      const category = await getCategoryInTransaction(transaction, input.categoryId);
      if (!category) {
        throw new ExpenseServiceError("INVALID_CATEGORY", "The selected category does not exist or is archived.");
      }
    }

    const patch: Record<string, unknown> = {};
    const before: Record<string, unknown> = {};
    const after: Record<string, unknown> = {};

    if (input.title !== undefined) {
      before["title"] = existing.title;
      after["title"] = input.title;
      patch["title"] = input.title;
    }
    if (input.notes !== undefined) {
      before["notes"] = existing.notes;
      after["notes"] = input.notes;
      patch["notes"] = input.notes;
    }
    if (input.categoryId !== undefined) {
      before["categoryId"] = existing.categoryId;
      after["categoryId"] = input.categoryId;
      patch["categoryId"] = input.categoryId;
    }
    if (input.date !== undefined) {
      before["date"] = existing.date;
      after["date"] = input.date;
      patch["date"] = input.date;
    }
    if (input.frequency !== undefined) {
      before["frequency"] = existing.frequency;
      after["frequency"] = input.frequency;
      patch["frequency"] = input.frequency;
    }

    const auditEvent: AuditEvent = {
      action: "record.correct",
      actor: { uid: user.uid, role: user.role },
      target: { collection: "expenses", id: expenseId },
      before,
      after,
      reason: input.reason,
    };

    correctExpenseInTransaction(transaction, expenseId, patch, input.expectedRevision, user.uid, auditEvent);
  });
}

/**
 * Soft-archives an expense (Super Admin only).
 * Archived expenses are excluded from financial aggregates but remain in the audit trail.
 */
export async function archiveExpense(
  sessionCookie: string | undefined,
  expenseId: string,
  input: ArchiveExpenseInput,
): Promise<void> {
  const user = await getSessionUser(sessionCookie);
  if (!canCorrectOperationalRecord(user)) throw new AuthorizationError();

  const db = getAdminDb();
  await db.runTransaction(async (transaction) => {
    const existing = await getExpenseInTransaction(transaction, expenseId);
    if (!existing) throw new ExpenseServiceError("NOT_FOUND", "Expense not found.", 404);
    if (existing.archivedAt !== null) throw new ExpenseServiceError("ALREADY_ARCHIVED", "This expense is already archived.");
    if (existing.revision !== input.expectedRevision) {
      throw new ExpenseServiceError("REVISION_CONFLICT", "This record was modified since you loaded it.", 409);
    }

    const auditEvent: AuditEvent = {
      action: "record.archive",
      actor: { uid: user.uid, role: user.role },
      target: { collection: "expenses", id: expenseId },
      before: {
        title: existing.title,
        amount: existing.originalAmountMinor,
        date: existing.date,
        archivedAt: null,
      },
      after: {
        title: existing.title,
        amount: existing.originalAmountMinor,
        date: existing.date,
        archivedAt: "server_timestamp",
      },
      reason: input.reason,
    };

    archiveExpenseInTransaction(transaction, expenseId, input.expectedRevision, user.uid, auditEvent);
  });
}
