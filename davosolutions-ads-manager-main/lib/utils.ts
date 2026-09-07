import type {
  AdsAccount,
  AdsAccountNode,
  BusinessAccount,
  BusinessAccountNode,
  FinancialSummary,
  GmailAccount,
  GmailAccountNode,
  Transaction,
  DailyEntry,
} from "@/types";

/** Cost-per-conversion above this triggers the elevated-CPR visual flag. */
export const CPA_THRESHOLD = 100;
/** Cost-per-conversion above this triggers the high-CPR visual flag. */
export const CPA_HIGH_THRESHOLD = 120;

/** Hard caps from the account hierarchy. */
export const MAX_BUSINESS_PER_GMAIL = 3;
export const MAX_ADS_PER_BUSINESS = 3;

/** Display currency. Change to "USD" (and $ below) if you'd rather track in dollars. */
export const CURRENCY = "NGN";
const CURRENCY_SYMBOL = "₦";

export function formatCurrency(amount: number): string {
  const formatted = new Intl.NumberFormat("en-NG", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount));
  return `${amount < 0 ? "-" : ""}${CURRENCY_SYMBOL}${formatted}`;
}

export function formatDate(ms: number): string {
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(ms));
}

export function formatDateTime(ms: number): string {
  return new Intl.DateTimeFormat("en-NG", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function formatInputDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function todayInputDate(): string {
  return formatInputDate(Date.now());
}

export function getCpaAlertLevel(account: Pick<AdsAccount, "cpa" | "status">): "normal" | "elevated" | "high" {
  if (account.status !== "active") return "normal";
  if (account.cpa > CPA_HIGH_THRESHOLD) return "high";
  if (account.cpa > CPA_THRESHOLD) return "elevated";
  return "normal";
}

/** Builds the nested Gmail → Business → Ads tree from three flat collections. */
export function buildAccountTree(
  gmailAccounts: GmailAccount[],
  businessAccounts: BusinessAccount[],
  adsAccounts: AdsAccount[],
  dateRangeEntries?: { transactions: Transaction[]; dailyEntries: DailyEntry[] }
): GmailAccountNode[] {
  return gmailAccounts
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((gmail) => {
      const businesses: BusinessAccountNode[] = businessAccounts
        .filter((b) => b.gmailAccountId === gmail.id)
        .sort((a, b) => a.createdAt - b.createdAt)
        .map((business) => {
          let bFunded = business.amountFunded;
          let bCharges = business.totalCharges || 0;
          let bLost = business.amountLost;

          if (dateRangeEntries) {
            const bTxs = dateRangeEntries.transactions.filter((tx) => tx.businessAccountId === business.id);
            bFunded = bTxs.filter((tx) => tx.type === "funding").reduce((sum, tx) => sum + tx.amount, 0);
            bCharges = bTxs.filter((tx) => tx.type === "funding").reduce((sum, tx) => sum + (tx.charge || 0), 0);
            bLost = bTxs.filter((tx) => tx.type === "loss").reduce((sum, tx) => sum + tx.amount, 0);
          }

          const ads: AdsAccountNode[] = adsAccounts
            .filter((a) => a.businessAccountId === business.id)
            .sort((a, b) => a.createdAt - b.createdAt)
            .map((ad) => {
              let aSpent = ad.amountSpent;
              let aCpa = ad.cpa;

              if (dateRangeEntries) {
                const aEntries = dateRangeEntries.dailyEntries.filter((e) => e.adsAccountId === ad.id);
                aSpent = aEntries.reduce((sum, e) => sum + e.spend, 0);
                const latestEntry = aEntries.sort((a, b) => b.date - a.date)[0];
                aCpa = latestEntry ? latestEntry.cpa : 0;
              }

              return { ...ad, amountSpent: aSpent, cpa: aCpa };
            });

          return { ...business, amountFunded: bFunded, totalCharges: bCharges, amountLost: bLost, adsAccounts: ads };
        });
      return { ...gmail, businessAccounts: businesses };
    });
}

export function getBusinessFinancials(
  business: Pick<BusinessAccount, "id" | "amountFunded" | "amountLost" | "totalCharges">,
  adsAccounts: Pick<AdsAccount, "amountSpent" | "status" | "businessAccountId">[]
) {
  const b_ads = adsAccounts.filter((a) => a.businessAccountId === business.id);
  const spent = b_ads.reduce((sum, a) => sum + a.amountSpent, 0);
  let lost = business.amountLost;
  let remaining = business.amountFunded - spent - lost;

  if (b_ads.length === 3 && b_ads.every((a) => a.status === "blocked") && remaining > 0) {
    lost += remaining;
    remaining = 0;
  }

  return { spent, remaining, lost };
}

/** Pure rollup: Total Funded − Total Spent − Total Lost = Remaining Active Balance. */
export function computeSummary(
  businessAccounts: BusinessAccount[],
  adsAccounts: AdsAccount[],
  dateRangeEntries?: { transactions: Transaction[]; dailyEntries: DailyEntry[] }
): FinancialSummary {
  let totalFunded = 0;
  let totalSpent = 0;
  let totalLost = 0;
  let totalCharges = 0;

  if (dateRangeEntries) {
    // Date-filtered mode: calculate directly from raw transactions and dailyEntries
    for (const tx of dateRangeEntries.transactions) {
      if (tx.type === "funding") {
        totalFunded += tx.amount;
        totalCharges += tx.charge || 0;
      } else if (tx.type === "loss") {
        totalLost += tx.amount;
      }
    }
    for (const entry of dateRangeEntries.dailyEntries) {
      totalSpent += entry.spend;
    }
  } else {
    // All-time mode: use pre-calculated totals from account documents
    for (const b of businessAccounts) {
      totalFunded += b.amountFunded;
      totalCharges += b.totalCharges || 0;

      const fins = getBusinessFinancials(b, adsAccounts);
      totalSpent += fins.spent;
      totalLost += fins.lost;
    }
  }

  return {
    totalFunded,
    totalSpent,
    totalLost,
    totalCharges,
    totalDebited: totalFunded + totalCharges,
    remainingBalance: totalFunded - totalSpent - totalLost,
  };
}

export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

/** Normalizes a timestamp to local midnight, so entries logged at different
 *  times on the same day still group onto one point on a chart. */
export function dayKey(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function shortDate(ms: number): string {
  return new Intl.DateTimeFormat("en-NG", { month: "short", day: "2-digit" }).format(new Date(ms));
}

export interface DailyPoint {
  date: number;
  label: string;
  spend: number;
  avgCpa: number;
}

/** One point per calendar day: total spend that day, average CPA across
 *  whatever accounts had an entry that day. */
export function aggregateEntriesByDate(entries: Array<{ date: number; spend: number; cpa: number }>): DailyPoint[] {
  const map = new Map<number, { spend: number; cpaSum: number; count: number }>();
  for (const e of entries) {
    const key = dayKey(e.date);
    const existing = map.get(key) ?? { spend: 0, cpaSum: 0, count: 0 };
    existing.spend += e.spend;
    existing.cpaSum += e.cpa;
    existing.count += 1;
    map.set(key, existing);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a - b)
    .map(([date, v]) => ({
      date,
      label: shortDate(date),
      spend: v.spend,
      avgCpa: v.count ? v.cpaSum / v.count : 0,
    }));
}

export interface AccountSpendPoint {
  id: string;
  name: string;
  spend: number;
}

/** Total spend per ads account within whatever entries were passed in. */
export function aggregateEntriesByAccount(
  entries: Array<{ adsAccountId: string; adsName: string; spend: number }>
): AccountSpendPoint[] {
  const map = new Map<string, AccountSpendPoint>();
  for (const e of entries) {
    const existing = map.get(e.adsAccountId) ?? { id: e.adsAccountId, name: e.adsName, spend: 0 };
    existing.spend += e.spend;
    map.set(e.adsAccountId, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
}
