import "server-only";
import { createHash } from "crypto";

import { getAdminDb } from "../../lib/firebase/admin";
import { getSessionUser, AuthorizationError } from "../../lib/auth/session";
import { isSuperAdmin } from "../../lib/auth/permissions";
import { createMoneySnapshot, assertCurrency, type CurrencyCode, type MoneySnapshot } from "../../domain/money";
import { assertDateOnly, type DateOnly } from "../../domain/dates";
import type { RevenueRecord, RevenueSource } from "../../domain/models";
import type { AuditEvent } from "../../lib/server/audit-model";
import { getSettingsInTransaction, lockBaseCurrencyInTransaction } from "../../lib/server/repositories/settings";
import { getEffectiveRateInTransaction } from "../../lib/server/repositories/exchange-rates";
import { checkIdempotency } from "../../lib/server/repositories/idempotency";
import {
  createRevenueInTransaction,
  correctRevenueInTransaction,
  archiveRevenueInTransaction,
  getRevenueInTransaction,
} from "../../lib/server/repositories/revenue";
import {
  getRevenueSources,
  getRevenueSource,
  createRevenueSource,
  updateRevenueSource,
} from "../../lib/server/repositories/revenue-sources";
import type { 
  CreateRevenueDto, 
  CorrectRevenueDto, 
  ArchiveRevenueDto, 
  CreateRevenueSourceDto, 
  UpdateRevenueSourceDto 
} from "./schema";
import { verifyAttachmentsUpload } from "../../lib/server/repositories/attachments";

export class RevenueServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
  ) {
    super(message);
    this.name = "RevenueServiceError";
  }
}

async function verifySuperAdmin(sessionCookie?: string) {
  const user = await getSessionUser(sessionCookie);
  if (!isSuperAdmin(user)) throw new AuthorizationError();
  return user;
}

export class RevenueSourceService {
  async listSources(sessionCookie?: string): Promise<RevenueSource[]> {
    await verifySuperAdmin(sessionCookie);
    return await getRevenueSources(true);
  }

  async getSource(sessionCookie: string | undefined, id: string): Promise<RevenueSource | null> {
    await verifySuperAdmin(sessionCookie);
    return await getRevenueSource(id);
  }

  async createSource(sessionCookie: string | undefined, input: CreateRevenueSourceDto): Promise<RevenueSource> {
    await verifySuperAdmin(sessionCookie);
    return await createRevenueSource(input.name, input.sortOrder, input.status);
  }

  async updateSource(sessionCookie: string | undefined, id: string, input: UpdateRevenueSourceDto): Promise<void> {
    await verifySuperAdmin(sessionCookie);
    await updateRevenueSource(id, input);
  }
}

export interface CreateRevenueResult {
  readonly id: string;
  readonly baseAmountMinor: number;
  readonly baseCurrency: CurrencyCode;
}

export class RevenueService {
  /**
   * Generates a stable hash for a revenue creation request to prevent duplicate submissions.
   */
  private canonicalRevenueHash(input: CreateRevenueDto): string {
    const raw = `${input.sourceId}|${input.date}|${input.amount}|${input.currency}|${input.description}`;
    return createHash("sha256").update(raw).digest("hex");
  }

  async createRevenue(
    sessionCookie: string | undefined,
    input: CreateRevenueDto,
  ): Promise<CreateRevenueResult> {
    const user = await verifySuperAdmin(sessionCookie);

    const hash = this.canonicalRevenueHash(input);
    const idempotencyCheck = await checkIdempotency(input.idempotencyKey, hash);
    if (idempotencyCheck.conflict) {
      throw new RevenueServiceError("IDEMPOTENCY_CONFLICT", "This request conflicts with a previous submission.", 409);
    }
    if (idempotencyCheck.existing !== null) {
      return { id: idempotencyCheck.existing, baseAmountMinor: 0, baseCurrency: "NGN" };
    }

    try {
      assertDateOnly(input.date as DateOnly);
    } catch {
      throw new RevenueServiceError("INVALID_DATE", "The revenue date is not a valid calendar day.");
    }

    try {
      assertCurrency(input.currency);
    } catch {
      throw new RevenueServiceError("INVALID_CURRENCY", "The selected currency is not supported.");
    }
    const currency = input.currency as CurrencyCode;

    const attachments = await verifyAttachmentsUpload(input.attachmentIds, user.uid);

    const db = getAdminDb();
    const result = await db.runTransaction(async (transaction) => {
      const settings = await getSettingsInTransaction(transaction);
      if (!settings) {
        throw new RevenueServiceError("SETTINGS_MISSING", "Company settings must be configured first.", 503);
      }

      if (!settings.enabledCurrencies.includes(currency)) {
        throw new RevenueServiceError("CURRENCY_DISABLED", `${currency} is not enabled.`);
      }

      const sourceDoc = await transaction.get(db.collection("revenueSources").doc(input.sourceId));
      if (!sourceDoc.exists) {
        throw new RevenueServiceError("INVALID_SOURCE", "The selected revenue source does not exist.");
      }

      const baseCurrency = settings.baseCurrency;
      let exchangeRate: string;
      let rateDate: DateOnly;

      if (currency === baseCurrency) {
        exchangeRate = "1";
        rateDate = input.date as DateOnly;
      } else {
        const rate = await getEffectiveRateInTransaction(transaction, currency, baseCurrency, input.date as DateOnly);
        if (!rate) {
          throw new RevenueServiceError(
            "RATE_NOT_CONFIGURED",
            `No exchange rate is configured for ${currency} → ${baseCurrency}.`,
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
        throw new RevenueServiceError("INVALID_AMOUNT", error instanceof Error ? error.message : "Invalid amount.");
      }

      const revenue: Omit<RevenueRecord, "id" | "createdAt" | "updatedAt" | "revision"> = {
        description: input.description,
        ...snapshot,
        sourceId: input.sourceId,
        date: input.date as DateOnly,
        notes: input.notes,
        attachments: attachments,
        createdBy: user.uid,
        archivedAt: null,
        archivedBy: null,
      };

      const auditEvent: AuditEvent = {
        action: "record.create",
        actor: { uid: user.uid, role: user.role },
        target: { collection: "revenue", id: "pending" },
        after: {
          description: input.description,
          amount: input.amount,
          currency,
          baseCurrency,
          baseAmountMinor: snapshot.baseAmountMinor,
          date: input.date,
          sourceId: input.sourceId,
        },
      };

      const revenueId = createRevenueInTransaction(
        transaction,
        revenue,
        { snapshot, postedOn: input.date as DateOnly, sourceId: input.sourceId },
        auditEvent,
        input.idempotencyKey,
        hash,
      );

      lockBaseCurrencyInTransaction(transaction, settings);

      for (const att of attachments) {
        transaction.update(db.collection("attachments").doc(att.id), {
          associatedRecordId: revenueId,
          associatedRecordKind: "revenue",
        });
      }

      return {
        id: revenueId,
        baseAmountMinor: snapshot.baseAmountMinor,
        baseCurrency,
      };
    });

    return result;
  }

  async correctRevenue(
    sessionCookie: string | undefined,
    revenueId: string,
    input: CorrectRevenueDto,
  ): Promise<void> {
    const user = await verifySuperAdmin(sessionCookie);

    const db = getAdminDb();
    await db.runTransaction(async (transaction) => {
      const existing = await getRevenueInTransaction(transaction, revenueId);
      if (!existing) throw new RevenueServiceError("NOT_FOUND", "Revenue record not found.", 404);
      if (existing.archivedAt !== null) throw new RevenueServiceError("ARCHIVED", "Cannot correct an archived record.");
      if (existing.revision !== input.expectedRevision) {
        throw new RevenueServiceError("REVISION_CONFLICT", "This record was modified since you loaded it.", 409);
      }

      if (input.date) {
        try {
          assertDateOnly(input.date as DateOnly);
        } catch {
          throw new RevenueServiceError("INVALID_DATE", "The corrected date is not a valid calendar day.");
        }
      }

      if (input.sourceId) {
        const sourceDoc = await transaction.get(db.collection("revenueSources").doc(input.sourceId));
        if (!sourceDoc.exists) {
          throw new RevenueServiceError("INVALID_SOURCE", "The selected source does not exist.");
        }
      }

      const patch: Record<string, unknown> = {};
      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      if (input.description !== undefined) {
        before["description"] = existing.description;
        after["description"] = input.description;
        patch["description"] = input.description;
      }
      if (input.notes !== undefined) {
        before["notes"] = existing.notes;
        after["notes"] = input.notes;
        patch["notes"] = input.notes;
      }
      if (input.sourceId !== undefined) {
        before["sourceId"] = existing.sourceId;
        after["sourceId"] = input.sourceId;
        patch["sourceId"] = input.sourceId;
      }
      if (input.date !== undefined) {
        before["date"] = existing.date;
        after["date"] = input.date;
        patch["date"] = input.date;
      }

      const auditEvent: AuditEvent = {
        action: "record.correct",
        actor: { uid: user.uid, role: user.role },
        target: { collection: "revenue", id: revenueId },
        before,
        after,
        reason: input.reason,
      };

      correctRevenueInTransaction(transaction, revenueId, patch, input.expectedRevision, user.uid, auditEvent);
    });
  }

  async archiveRevenue(
    sessionCookie: string | undefined,
    revenueId: string,
    input: ArchiveRevenueDto,
  ): Promise<void> {
    const user = await verifySuperAdmin(sessionCookie);

    const db = getAdminDb();
    await db.runTransaction(async (transaction) => {
      const existing = await getRevenueInTransaction(transaction, revenueId);
      if (!existing) throw new RevenueServiceError("NOT_FOUND", "Revenue record not found.", 404);
      if (existing.archivedAt !== null) throw new RevenueServiceError("ALREADY_ARCHIVED", "This record is already archived.");
      if (existing.revision !== input.expectedRevision) {
        throw new RevenueServiceError("REVISION_CONFLICT", "This record was modified since you loaded it.", 409);
      }

      const auditEvent: AuditEvent = {
        action: "record.archive",
        actor: { uid: user.uid, role: user.role },
        target: { collection: "revenue", id: revenueId },
        before: {
          description: existing.description,
          amount: existing.originalAmountMinor,
          date: existing.date,
          archivedAt: null,
        },
        after: {
          description: existing.description,
          amount: existing.originalAmountMinor,
          date: existing.date,
          archivedAt: "server_timestamp",
        },
        reason: input.reason,
      };

      archiveRevenueInTransaction(transaction, revenueId, input.expectedRevision, user.uid, auditEvent);
    });
  }
}
