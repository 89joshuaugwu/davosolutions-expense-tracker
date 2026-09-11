import "server-only";

import { getCompanySettings } from "@/lib/server/repositories/settings";
import { getMonthlyFund, getLedgerEntriesForMonth } from "@/lib/server/repositories/monthly-funds";
import { calculateFinancialSummary } from "@/domain/ledger";
import type { UserProfile } from "@/lib/auth/model";
import { isSuperAdmin, canViewOperationalTotals } from "@/lib/auth/permissions";
import { listExpenses } from "@/lib/server/repositories/expenses";
import { getBills } from "@/lib/server/repositories/bills";
import type { ReportingMonth } from "@/domain/dates";

export class DashboardService {
  /**
   * Retrieves the full analytics payload for Super Admins or permitted Secretaries.
   */
  static async getAnalytics(user: UserProfile, month: ReportingMonth) {
    if (!canViewOperationalTotals(user)) {
      throw new Error("Forbidden: Missing operational totals permission");
    }

    const settings = await getCompanySettings();
    if (!settings) throw new Error("Settings not found");

    const fund = await getMonthlyFund(month);
    const openingFundMinor = fund ? fund.baseAmountMinor : 0;

    const postings = await getLedgerEntriesForMonth(month);

    const summary = calculateFinancialSummary({
      month,
      baseCurrency: settings.baseCurrency,
      openingFundMinor,
      postings,
    });

    // We can also calculate top expense categories
    const expensePostings = postings.filter(p => p.direction === "expense" && !p.archivedAt);
    const categoryTotals = new Map<string, number>();
    for (const p of expensePostings) {
      if (!p.categoryId) continue;
      const current = categoryTotals.get(p.categoryId) || 0;
      categoryTotals.set(p.categoryId, current + p.baseAmountMinor);
    }
    const categoryBreakdown = Array.from(categoryTotals.entries())
      .map(([categoryId, totalMinor]) => ({ categoryId, totalMinor }))
      .sort((a, b) => b.totalMinor - a.totalMinor);

    // Revenue breakdown
    const revenuePostings = postings.filter(p => p.direction === "revenue" && !p.archivedAt);
    const revenueTotals = new Map<string, number>();
    for (const p of revenuePostings) {
      if (!p.revenueSourceId) continue;
      const current = revenueTotals.get(p.revenueSourceId) || 0;
      revenueTotals.set(p.revenueSourceId, current + p.baseAmountMinor);
    }
    const revenueBreakdown = Array.from(revenueTotals.entries())
      .map(([sourceId, totalMinor]) => ({ sourceId, totalMinor }))
      .sort((a, b) => b.totalMinor - a.totalMinor);

    return {
      summary,
      hasFund: !!fund,
      categoryBreakdown,
      revenueBreakdown,
    };
  }

  /**
   * Retrieves recent activity. Visible to both Admins and Secretaries.
   * Super Admins see everything. Secretaries see their own and assigned.
   */
  static async getRecentActivity(user: UserProfile) {
    // We only take the first 5.
    const allExpenses = await listExpenses({ uid: user.uid, isSuperAdmin: isSuperAdmin(user), pageSize: 5 });
    // sort desc by createdAt
    const recentExpenses = allExpenses.items.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);

    const activeBills = await getBills({ status: "active", userId: isSuperAdmin(user) ? undefined : user.uid });
    // sort asc by nextDueDate (getBills already sorts ascending by nextDueDate)
    const upcomingBills = activeBills.slice(0, 5);

    return {
      recentExpenses,
      upcomingBills,
    };
  }
}
