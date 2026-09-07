import "server-only";
import { calculateFinancialSummary, createLedgerPosting } from "@/domain/ledger";
import { createMoneySnapshot } from "@/domain/money";

// FICTIONAL, public design fixtures. This module must never query Firebase.
export type PreviewExpense = { id: string; title: string; category: string; date: string; amountMinor: number; person: string; initials: string; frequency: string; notes: string };
export const sampleExpenses: PreviewExpense[] = [
  { id: "sample-1", title: "Office internet subscription", category: "Bills & subscriptions", date: "2026-09-07", amountMinor: 4800000, person: "Amara Okafor", initials: "AO", frequency: "Monthly", notes: "Fictional sample: September office internet subscription. No receipt is attached." },
  { id: "sample-2", title: "Team transportation", category: "Transportation", date: "2026-09-07", amountMinor: 1850000, person: "Amara Okafor", initials: "AO", frequency: "Daily", notes: "Fictional sample: morning ₦10,000 and evening ₦8,500. This is one daily transport total." },
  { id: "sample-3", title: "Workspace essentials", category: "Office supplies", date: "2026-09-06", amountMinor: 3250000, person: "Davo Admin", initials: "DA", frequency: "One-time", notes: "Fictional sample: stationery and desk supplies for the office." },
  { id: "sample-4", title: "Design software license", category: "Bills & subscriptions", date: "2026-09-05", amountMinor: 4800000, person: "Davo Admin", initials: "DA", frequency: "Monthly", notes: "Fictional sample: USD 30 at a saved rate of ₦1,600 per USD = ₦48,000. Not a current exchange-rate quote." },
  { id: "sample-5", title: "September salary payment", category: "Salaries", date: "2026-09-04", amountMinor: 45000000, person: "Davo Admin", initials: "DA", frequency: "Monthly", notes: "Fictional sample: salary payment for a sample employee. This is not a real payroll record." },
];

export function previewExpenses(month: string, secretary: boolean) {
  return sampleExpenses.filter((row) => row.date.startsWith(month) && (!secretary || row.person === "Amara Okafor"));
}

export function previewFinancials(month: string) {
  const active = month === "2026-09" || month === "2026-08";
  const september = month === "2026-09";
  const expenseAmounts = active ? (september ? ["780000", "420000", "310000", "185000", "125000"] : ["720000", "350000", "280000", "170000", "130000"]) : [];
  const sourceAmounts = active ? (september ? ["2650000", "1420000", "780000"] : ["2400000", "1180000", "620000"]) : [];
  const categories = ["Salaries", "Bills & subscriptions", "Office supplies", "Transportation", "Other expenses"];
  const sourceNames = ["Digital advertising", "Consulting", "Creative services"];
  const postings = [
    ...expenseAmounts.map((amount, i) => createLedgerPosting({ ...createMoneySnapshot({ amount, currency: "NGN", baseCurrency: "NGN", exchangeRate: "1", rateDate: `${month}-01` }), sourceKind: "expense", sourceId: `sample-cost-${i}`, postedOn: `${month}-07`, categoryId: categories[i], revenueSourceId: null })),
    ...sourceAmounts.map((amount, i) => createLedgerPosting({ ...createMoneySnapshot({ amount, currency: "NGN", baseCurrency: "NGN", exchangeRate: "1", rateDate: `${month}-01` }), sourceKind: "revenue", sourceId: `sample-revenue-${i}`, postedOn: `${month}-07`, categoryId: null, revenueSourceId: sourceNames[i] })),
  ];
  return {
    summary: calculateFinancialSummary({ month, baseCurrency: "NGN", openingFundMinor: active ? (september ? 240000000 : 200000000) : 0, postings }),
    breakdown: expenseAmounts.map((amount, i) => ({ name: categories[i], value: Number(amount) })),
    sources: sourceAmounts.map((amount, i) => ({ name: sourceNames[i], amountMinor: Number(amount) * 100 })),
  };
}

export const sampleTrend = [
  { month: "Apr", revenue: 2400000, expenses: 1380000, profit: 1020000 },
  { month: "May", revenue: 2850000, expenses: 1520000, profit: 1330000 },
  { month: "Jun", revenue: 2620000, expenses: 1480000, profit: 1140000 },
  { month: "Jul", revenue: 3580000, expenses: 1780000, profit: 1800000 },
  { month: "Aug", revenue: 4200000, expenses: 1650000, profit: 2550000 },
  { month: "Sep", revenue: 4850000, expenses: 1820000, profit: 3030000 },
];
