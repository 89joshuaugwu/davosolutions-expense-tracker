import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import type { UserProfile } from "@/lib/auth/model";
import { checkIdempotency } from "@/lib/server/repositories/idempotency";
import { createMonthlyFundInTransaction, getMonthlyFunds, getMonthlyFund, getLedgerEntriesForMonth } from "@/lib/server/repositories/monthly-funds";
import { createMonthlyFundSchema, parseFundAmount, type CreateMonthlyFundDto } from "./schema";
import { getEffectiveRate } from "@/lib/server/repositories/exchange-rates";
import { getCompanySettings } from "@/lib/server/repositories/settings";
import { isSuperAdmin } from "@/lib/auth/permissions";
import { calculateFinancialSummary } from "@/domain/ledger";

export class MonthlyFundsService {
  static async createMonthlyFund(user: UserProfile, input: CreateMonthlyFundDto): Promise<{ id: string }> {
    if (!isSuperAdmin(user)) throw new Error("Forbidden: Super Admin only");

    const data = createMonthlyFundSchema.parse(input);
    const amountMinor = parseFundAmount(data.originalAmount, data.currency);

    const settings = await getCompanySettings();
    if (!settings) throw new Error("System settings missing");
    if (data.currency !== settings.baseCurrency && !settings.enabledCurrencies.includes(data.currency)) {
      throw new Error(`Currency ${data.currency} is not enabled`);
    }

    const { existing, conflict } = await checkIdempotency(`${user.uid}_createFund_${data.idempotencyKey}`, "dummy-hash");
    if (conflict) throw new Error("Idempotency conflict");
    if (existing) return { id: existing };

    const db = getAdminDb();
    return db.runTransaction(async (t) => {
      // Check if fund for this month already exists
      const existingRef = db.collection("monthlyFunds").doc(data.month);
      const existingSnap = await t.get(existingRef);
      if (existingSnap.exists) {
        throw new Error(`A fund allocation already exists for month ${data.month}`);
      }

      let baseAmountMinor = amountMinor;
      let rateSnapshot = "1.000000";
      let rateDate = `${data.month}-01`;

      if (data.currency !== settings.baseCurrency) {
        // Find exchange rate effectively on the 1st of the month
        const fx = await getEffectiveRate(data.currency, settings.baseCurrency, rateDate);
        if (!fx) throw new Error(`No exchange rate found for ${data.currency} on ${rateDate}`);
        rateSnapshot = fx.rate;
        rateDate = fx.effectiveFrom;
        const rateNum = parseFloat(fx.rate);
        baseAmountMinor = Math.round(amountMinor * rateNum);
      }

      const fundId = createMonthlyFundInTransaction(
        t,
        {
          month: data.month as any,
          source: data.source || "",
          originalAmountMinor: amountMinor,
          currency: data.currency,
          baseCurrency: settings.baseCurrency,
          exchangeRateSnapshot: rateSnapshot,
          rateDate: rateDate,
          baseAmountMinor: baseAmountMinor,
          notes: data.notes || "",
          attachments: [],
          createdBy: user.uid,
          archivedAt: null,
          archivedBy: null,
        },
        user.role,
        data.idempotencyKey
      );

      return { id: fundId };
    });
  }

  static async getMonthlyFunds(user: UserProfile) {
    if (!isSuperAdmin(user)) throw new Error("Forbidden: Super Admin only");
    return getMonthlyFunds();
  }

  static async getMonthlySummary(user: UserProfile, month: string) {
    if (!isSuperAdmin(user)) throw new Error("Forbidden: Super Admin only");

    const fund = await getMonthlyFund(month);
    // Even if fund is null, we can still calculate expenses for the month, but UI needs to handle missing fund.
    const postings = await getLedgerEntriesForMonth(month);

    const settings = await getCompanySettings();
    if (!settings) throw new Error("System settings missing");

    const summary = calculateFinancialSummary({
      month: month as any,
      baseCurrency: settings.baseCurrency,
      openingFundMinor: fund ? fund.baseAmountMinor : 0,
      postings,
    });

    return { fund, summary };
  }
}
