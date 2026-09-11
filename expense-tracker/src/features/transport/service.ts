import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import type { UserProfile } from "@/lib/auth/model";
import { checkIdempotency } from "@/lib/server/repositories/idempotency";
import { createTransportInTransaction, getTransportList, getTransportLog, updateTransportInTransaction, type TransportListItem } from "@/lib/server/repositories/transport";
import { createTransportSchema, correctTransportSchema, parseTransportAmounts, type CreateTransportDto, type CorrectTransportDto } from "./schema";
import { getEffectiveRate } from "@/lib/server/repositories/exchange-rates";
import { getCompanySettings } from "@/lib/server/repositories/settings";
import { canViewOperationalKind, isSuperAdmin } from "@/lib/auth/permissions";

export class TransportService {
  static async logTransport(user: UserProfile, input: CreateTransportDto): Promise<{ id: string }> {
    const data = createTransportSchema.parse(input);

    const settings = await getCompanySettings();
    if (!settings) throw new Error("System settings missing");
    if (data.currency !== settings.baseCurrency && !settings.enabledCurrencies.includes(data.currency)) {
      throw new Error(`Currency ${data.currency} is not enabled`);
    }

    const { mMinor, eMinor, xMinor, totalMinor } = parseTransportAmounts(
      data.morningAmount,
      data.eveningAmount,
      data.extraAmount,
      data.currency
    );

    let baseAmountMinor = totalMinor;
    let rateSnapshot = "1.000000";
    let rateDate = data.date;

    if (data.currency !== settings.baseCurrency) {
      const fx = await getEffectiveRate(data.currency, settings.baseCurrency, data.date);
      if (!fx) throw new Error(`No exchange rate found for ${data.currency} on ${data.date}`);
      rateSnapshot = fx.rate;
      rateDate = fx.effectiveFrom;
      const rateNum = parseFloat(fx.rate);
      baseAmountMinor = Math.round(totalMinor * rateNum);
    }

    // Check idempotency outside transaction to quickly reject duplicates without read-locking
    const { existing, conflict } = await checkIdempotency(`${user.uid}_createTransport_${data.idempotencyKey}`, "dummy-hash");
      
    if (conflict) {
      throw new Error("Idempotency conflict");
    }
    if (existing) {
      return { id: existing };
    }

    const db = getAdminDb();

    return db.runTransaction(async (t) => {
      // Re-read category inside transaction
      const catRef = db.collection("categories").doc(data.categoryId);
      const catSnap = await t.get(catRef);
      if (!catSnap.exists || catSnap.data()?.isActive !== true) {
        throw new Error("Category not found or inactive");
      }

      const transportId = createTransportInTransaction(
        t,
        {
          kind: "transport",
          date: data.date,
          categoryId: data.categoryId,
          morningAmountMinor: mMinor,
          eveningAmountMinor: eMinor,
          extraAmountMinor: xMinor,
          extraReason: data.extraReason || "",
          originalAmountMinor: totalMinor,
          currency: data.currency,
          baseAmountMinor: baseAmountMinor,
          baseCurrency: settings.baseCurrency,
          exchangeRateSnapshot: rateSnapshot,
          rateDate: rateDate,
          notes: data.notes || "",
          attachments: [], // Needs Cloudinary adapter logic mapped before/after if we support attachment objects
          visibleToUserIds: [user.uid],
          createdBy: user.uid,
          archivedAt: null,
          archivedBy: null,
        },
        user.role,
        data.idempotencyKey,
        {} // We will inject ID below
      );

      return { id: transportId };
    });
  }

  static async getLogs(
    user: UserProfile,
    month: string | undefined,
    cursor: string | undefined,
    limitCount: number = 50
  ): Promise<{ logs: TransportListItem[]; nextCursor?: string }> {
    if (!canViewOperationalKind(user, "transport")) {
      return { logs: [] };
    }

    const userIdFilter = isSuperAdmin(user) ? undefined : user.uid;

    const items = await getTransportList({
      month,
      userId: userIdFilter,
      limitCount: limitCount + 1,
      startAfterId: cursor,
    });

    let nextCursor: string | undefined;
    if (items.length > limitCount) {
      nextCursor = items[limitCount - 1].id;
      items.pop();
    }

    return { logs: items, nextCursor };
  }

  static async getLogDetail(user: UserProfile, id: string) {
    if (!canViewOperationalKind(user, "transport")) return null;

    const log = await getTransportLog(id);
    if (!log) return null;

    if (!isSuperAdmin(user) && !log.visibleToUserIds.includes(user.uid)) {
      return null;
    }

    return log;
  }

  static async correctLog(user: UserProfile, id: string, input: CorrectTransportDto) {
    if (!isSuperAdmin(user)) throw new Error("Only Super Admin can correct or archive transport logs");

    const data = correctTransportSchema.parse(input);
    const db = getAdminDb();

    if (data.action !== "archive") {
      throw new Error("Only archive is supported right now");
    }

    await db.runTransaction(async (t) => {
      const logRef = db.collection("transportLogs").doc(id);
      const snap = await t.get(logRef);
      if (!snap.exists) throw new Error("Not found");

      const existing = snap.data() as unknown as import("@/domain/models").TransportLog;
      if (existing.revision !== data.expectedRevision) {
        throw new Error("Conflict: record has been updated by someone else.");
      }

      if (existing.archivedAt) {
        throw new Error("Record is already archived.");
      }

      updateTransportInTransaction(t, id, existing, {
        action: "archive" as const,
        reason: data.reason,
        actorId: user.uid,
        actorRole: user.role,
      });
    });
  }
}
