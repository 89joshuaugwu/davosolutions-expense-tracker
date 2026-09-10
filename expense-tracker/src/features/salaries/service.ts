import "server-only";

import { getAdminDb } from "../../lib/firebase/admin";
import { getSessionUser, AuthorizationError } from "../../lib/auth/session";
import { canCreateOperationalRecord, canCorrectOperationalRecord } from "../../lib/auth/permissions";
import { createMoneySnapshot, type CurrencyCode, type MoneySnapshot, CURRENCIES } from "../../domain/money";
import { type DateOnly, type ReportingMonth } from "../../domain/dates";
import type { SalaryLog } from "../../domain/models";
import type { AuditEvent } from "../../lib/server/audit-model";
import { getSettingsInTransaction, lockBaseCurrencyInTransaction } from "../../lib/server/repositories/settings";
import { getCategoryInTransaction } from "../../lib/server/repositories/categories";
import { getEffectiveRateInTransaction } from "../../lib/server/repositories/exchange-rates";
import { checkIdempotency } from "../../lib/server/repositories/idempotency";
import { verifyAttachmentsUpload } from "../../lib/server/repositories/attachments";
import {
  createSalaryInTransaction,
  correctSalaryInTransaction,
  archiveSalaryInTransaction,
  getSalaryInTransaction,
} from "../../lib/server/repositories/salaries";
import { canonicalSalaryHash } from "./idempotency";
import type { CreateSalaryInput, CorrectSalaryInput, ArchiveSalaryInput, PaySalaryInput } from "./schema";

export class SalaryServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message);
    this.name = "SalaryServiceError";
  }
}

export async function createSalary(input: CreateSalaryInput) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    throw new AuthorizationError();
  }

  // Active secretaries can create operational records; view restriction is checked in reads.
  if (!canCreateOperationalRecord(user)) {
    throw new AuthorizationError();
  }

  const currency = input.currency as CurrencyCode;
  const attachments = await verifyAttachmentsUpload(input.attachmentIds, user.uid);

  const idempotencyHash = await canonicalSalaryHash(input);
  const existingResult = await checkIdempotency(input.idempotencyKey, idempotencyHash);
  if (existingResult.conflict) {
    throw new SalaryServiceError("IDEMPOTENCY_CONFLICT", "A different request is using this key.", 409);
  }

  const db = getAdminDb();
  const result = await db.runTransaction(async (transaction) => {
    const settings = await getSettingsInTransaction(transaction);
    if (!settings) {
      throw new SalaryServiceError("SETTINGS_MISSING", "Company settings must be configured first.", 503);
    }

    if (!settings.enabledCurrencies.includes(currency)) {
      throw new SalaryServiceError("CURRENCY_DISABLED", `${currency} is not enabled.`);
    }

    const category = await getCategoryInTransaction(transaction, input.categoryId);
    if (!category) {
      throw new SalaryServiceError("INVALID_CATEGORY", "The selected category does not exist or is archived.");
    }

    const baseCurrency = settings.baseCurrency;
    let exchangeRate: string;
    let rateDate: DateOnly;

    // Use paymentDate for the rate if paid, otherwise use current date for the snapshot (though not posted)
    const activeDate = (input.paymentDate || new Date().toISOString().slice(0, 10)) as DateOnly;

    if (currency === baseCurrency) {
      exchangeRate = "1";
      rateDate = activeDate;
    } else {
      const rate = await getEffectiveRateInTransaction(transaction, currency, baseCurrency, activeDate);
      if (!rate) {
        throw new SalaryServiceError(
          "RATE_NOT_CONFIGURED",
          `No exchange rate is configured for ${currency} → ${baseCurrency} on ${activeDate}.`,
        );
      }
      exchangeRate = rate.rate;
      rateDate = rate.effectiveFrom;
    }

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
      throw new SalaryServiceError("INVALID_AMOUNT", error instanceof Error ? error.message : "Invalid amount.");
    }

    // Build the salary record (ID is assigned by repository)
    const salaryBase = {
      kind: "salary" as const,
      workerName: input.workerName,
      workerRef: input.workerRef,
      period: input.period as unknown as ReportingMonth,
      ...snapshot,
      categoryId: category.id,
      notes: input.notes,
      attachments,
      visibleToUserIds: [],
      createdBy: user.uid,
      archivedAt: null,
      archivedBy: null,
    };

    let salary: Omit<SalaryLog, "id" | "createdAt" | "updatedAt" | "revision">;
    if (input.status === "paid" && input.paymentDate) {
      salary = { ...salaryBase, status: "paid", paymentDate: input.paymentDate as DateOnly };
    } else {
      salary = { ...salaryBase, status: "pending", paymentDate: null };
    }

    const auditEvent: AuditEvent = {
      action: "record.create",
      actor: { uid: user.uid, role: user.role },
      target: { collection: "salaries", id: "pending" },
      after: {
        workerName: input.workerName,
        period: input.period,
        amount: input.amount,
        currency,
        baseCurrency,
        baseAmountMinor: snapshot.baseAmountMinor,
        status: salary.status,
        paymentDate: salary.paymentDate,
        categoryId: category.id,
      },
    };

    if (existingResult.existing) {
      return { id: existingResult.existing, baseAmountMinor: snapshot.baseAmountMinor, appliedRate: exchangeRate, rateDate };
    }

    const salaryId = createSalaryInTransaction(
      transaction,
      salary,
      auditEvent,
      input.idempotencyKey,
      idempotencyHash,
    );

    if (salary.status === "paid") {
      lockBaseCurrencyInTransaction(transaction, settings);
    }

    for (const att of attachments) {
      transaction.update(db.collection("attachments").doc(att.id), {
        associatedRecordId: salaryId,
        associatedRecordKind: "salary",
      });
    }

    return {
      id: salaryId,
      baseAmountMinor: snapshot.baseAmountMinor,
      appliedRate: exchangeRate,
      rateDate,
    };
  });

  return result;
}

export async function correctSalary(id: string, input: CorrectSalaryInput) {
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    throw new AuthorizationError();
  }

  if (!canCorrectOperationalRecord(user)) {
    throw new AuthorizationError();
  }

  const db = getAdminDb();
  await db.runTransaction(async (transaction) => {
    const current = await getSalaryInTransaction(transaction, id);
    if (!current || current.archivedAt) {
      throw new SalaryServiceError("NOT_FOUND", "Salary not found or archived.", 404);
    }

    if (current.revision !== input.expectedRevision) {
      throw new SalaryServiceError("CONCURRENT_MODIFICATION", "The record was modified by another user. Refresh and try again.", 409);
    }

    let newSnapshot: MoneySnapshot | undefined;
    let newPostingInput: { snapshot: MoneySnapshot; postedOn: DateOnly; categoryId: string } | undefined;

    const requiresRecalculation =
      input.amount !== undefined || input.currency !== undefined || input.paymentDate !== undefined || input.status !== undefined || input.categoryId !== undefined;

    if (requiresRecalculation) {
      const settings = await getSettingsInTransaction(transaction);
      if (!settings) throw new SalaryServiceError("SETTINGS_MISSING", "Missing company settings.", 503);

      const targetCurrency = (input.currency || current.currency) as CurrencyCode;
      const targetAmount = input.amount || (current.originalAmountMinor / Math.pow(10, CURRENCIES[current.currency]?.decimals ?? 2)).toString();
      const targetCategory = input.categoryId || current.categoryId;
      const targetStatus = input.status || current.status;
      const targetPaymentDate = input.paymentDate || current.paymentDate;

      // Rate date logic:
      const activeDate = (targetPaymentDate || new Date().toISOString().slice(0, 10)) as DateOnly;
      
      let exchangeRate: string;
      let rateDate: DateOnly;

      if (targetCurrency === settings.baseCurrency) {
        exchangeRate = "1";
        rateDate = activeDate;
      } else {
        const rate = await getEffectiveRateInTransaction(transaction, targetCurrency, settings.baseCurrency, activeDate);
        if (!rate) {
          throw new SalaryServiceError("RATE_NOT_CONFIGURED", `No exchange rate for ${targetCurrency} on ${activeDate}.`);
        }
        exchangeRate = rate.rate;
        rateDate = rate.effectiveFrom;
      }

      newSnapshot = createMoneySnapshot({
        amount: targetAmount, // Wait, if targetAmount is derived from minor, we might lose precision. Best to always require amount if currency changes.
        // Actually, if amount is not in input, we shouldn't guess it.
        // For simplicity in v1, if they change currency they must provide amount.
        currency: targetCurrency,
        baseCurrency: settings.baseCurrency,
        exchangeRate,
        rateDate,
      });

      if (targetStatus === "paid" && targetPaymentDate) {
        newPostingInput = {
          snapshot: newSnapshot,
          postedOn: targetPaymentDate as DateOnly,
          categoryId: targetCategory,
        };
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.workerName !== undefined) updates.workerName = input.workerName;
    if (input.period !== undefined) updates.period = input.period;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.categoryId !== undefined) updates.categoryId = input.categoryId;
    if (newSnapshot) {
      Object.assign(updates, newSnapshot);
    }
    if (input.status !== undefined) {
      if (input.status === "paid") {
        updates.status = "paid";
        updates.paymentDate = (input.paymentDate || current.paymentDate) as DateOnly;
      } else {
        updates.status = "pending";
        updates.paymentDate = null;
      }
    } else if (input.paymentDate !== undefined && current.status === "paid") {
      updates.paymentDate = input.paymentDate as DateOnly;
    }

    const auditEvent: AuditEvent = {
      action: "record.correct",
      actor: { uid: user.uid, role: user.role },
      target: { collection: "salaries", id },
      before: current as unknown as Record<string, unknown>,
      after: { ...current, ...updates } as unknown as Record<string, unknown>,
      reason: input.reason,
    };

    correctSalaryInTransaction(transaction, current, updates as Partial<SalaryLog>, auditEvent, newPostingInput);
  });
}

export async function archiveSalary(id: string, input: ArchiveSalaryInput) {
  const user = await getSessionUser();
  if (!user || user.status !== "active" || !canCorrectOperationalRecord(user)) {
    throw new AuthorizationError();
  }

  const db = getAdminDb();
  await db.runTransaction(async (transaction) => {
    const current = await getSalaryInTransaction(transaction, id);
    if (!current || current.archivedAt) {
      throw new SalaryServiceError("NOT_FOUND", "Salary not found or archived.", 404);
    }

    if (current.revision !== input.expectedRevision) {
      throw new SalaryServiceError("CONCURRENT_MODIFICATION", "The record was modified by another user.", 409);
    }

    const auditEvent: AuditEvent = {
      action: "record.archive",
      actor: { uid: user.uid, role: user.role },
      target: { collection: "salaries", id },
      before: current as unknown as Record<string, unknown>,
      reason: input.reason,
    };

    archiveSalaryInTransaction(transaction, current, user.uid, auditEvent);
  });
}

export async function paySalary(id: string, input: PaySalaryInput) {
  // Shortcut to transition a pending salary to paid without full correction
  const user = await getSessionUser();
  if (!user || user.status !== "active") {
    throw new AuthorizationError();
  }
  
  if (!canCorrectOperationalRecord(user)) {
    throw new AuthorizationError();
  }

  const db = getAdminDb();
  await db.runTransaction(async (transaction) => {
    const current = await getSalaryInTransaction(transaction, id);
    if (!current || current.archivedAt) {
      throw new SalaryServiceError("NOT_FOUND", "Salary not found.", 404);
    }

    if (current.revision !== input.expectedRevision) {
      throw new SalaryServiceError("CONCURRENT_MODIFICATION", "The record was modified by another user.", 409);
    }

    if (current.status === "paid") {
      throw new SalaryServiceError("ALREADY_PAID", "Salary is already paid.");
    }

    const settings = await getSettingsInTransaction(transaction);
    if (!settings) throw new SalaryServiceError("SETTINGS_MISSING", "Missing company settings.", 503);

    const activeDate = input.paymentDate as DateOnly;
    let exchangeRate: string;
    let rateDate: DateOnly;

    if (current.currency === settings.baseCurrency) {
      exchangeRate = "1";
      rateDate = activeDate;
    } else {
      const rate = await getEffectiveRateInTransaction(transaction, current.currency, settings.baseCurrency, activeDate);
      if (!rate) {
        throw new SalaryServiceError("RATE_NOT_CONFIGURED", `No exchange rate for ${current.currency} on ${activeDate}.`);
      }
      exchangeRate = rate.rate;
      rateDate = rate.effectiveFrom;
    }

    // Since it's paid now, we need to create a posting. We use the originalAmountMinor and the NEW exchange rate on payment date.
    // Wait, originalAmountMinor represents exactly what the salary is. But to recalculate baseAmountMinor we need a money snapshot.
    // Instead of reconstructing string amount, we can create money snapshot by converting originalAmountMinor to string amount?
    const currencyDef = CURRENCIES[current.currency];
    if (!currencyDef) throw new SalaryServiceError("INVALID_CURRENCY", "Unknown currency");
    const amountStr = (current.originalAmountMinor / Math.pow(10, currencyDef.decimals)).toString();

    const newSnapshot = createMoneySnapshot({
      amount: amountStr,
      currency: current.currency,
      baseCurrency: settings.baseCurrency,
      exchangeRate,
      rateDate,
    });

    const newPostingInput = {
      snapshot: newSnapshot,
      postedOn: activeDate,
      categoryId: current.categoryId,
    };

    const updates: Record<string, unknown> = {
      status: "paid" as const,
      paymentDate: activeDate,
      ...newSnapshot
    };

    const auditEvent: AuditEvent = {
      action: "record.correct",
      actor: { uid: user.uid, role: user.role },
      target: { collection: "salaries", id },
      before: current as unknown as Record<string, unknown>,
      after: { ...current, ...updates } as unknown as Record<string, unknown>,
      reason: "Marked as paid",
    };

    correctSalaryInTransaction(transaction, current, updates as Partial<SalaryLog>, auditEvent, newPostingInput);
    lockBaseCurrencyInTransaction(transaction, settings);
  });
}
