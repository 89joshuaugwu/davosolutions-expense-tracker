import { assertDateOnly, assertReportingMonth, reportingMonthOf, type DateOnly, type ReportingMonth } from "./dates";
import { assertCurrency, assertMinorAmount, assertMoneySnapshot, sumMinorAmounts, type CurrencyCode, type MoneySnapshot } from "./money";

export type PostingSourceKind = "expense" | "salary" | "transport" | "bill_payment" | "revenue";

export interface LedgerPosting extends MoneySnapshot {
  /** Exactly sourceKind:sourceId. A transaction creates this once with its source and audit entry. */
  readonly id: string;
  readonly sourceKind: PostingSourceKind;
  readonly sourceId: string;
  readonly direction: "expense" | "revenue";
  readonly postedOn: DateOnly;
  readonly categoryId: string | null;
  readonly revenueSourceId: string | null;
  readonly archivedAt: string | null;
}

export interface FinancialSummary {
  readonly month: ReportingMonth;
  readonly baseCurrency: CurrencyCode;
  readonly openingFundMinor: number;
  readonly totalRevenueMinor: number;
  readonly totalExpensesMinor: number;
  readonly remainingOpeningFundMinor: number;
  readonly netProfitMinor: number;
  readonly closingBalanceMinor: number;
  /** Two decimal places, null for zero revenue. Never use this display value for calculations. */
  readonly profitMarginPercent: number | null;
}

function assertDocumentKey(key: string): void {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(key)) throw new Error("Source ID must be a safe document key.");
}

export function ledgerEntryId(sourceKind: PostingSourceKind, sourceId: string): string {
  if (!["expense", "salary", "transport", "bill_payment", "revenue"].includes(sourceKind)) {
    throw new Error("Unknown ledger source kind.");
  }
  assertDocumentKey(sourceId);
  return `${sourceKind}:${sourceId}`;
}

/** One full payment per scheduled bill occurrence in v1; retries address the same document. */
export function billPaymentId(billId: string, occurrenceDate: DateOnly): string {
  assertDocumentKey(billId);
  assertDateOnly(occurrenceDate);
  // Keep generated IDs within the 128-character source key limit.
  if (billId.length > 116) throw new Error("Bill ID is too long for an occurrence payment ID.");
  return `${billId}__${occurrenceDate}`;
}

export function createLedgerPosting(input: Omit<LedgerPosting, "id" | "direction" | "archivedAt"> & {
  archivedAt?: string | null;
}): LedgerPosting {
  const posting: LedgerPosting = {
    ...input,
    id: ledgerEntryId(input.sourceKind, input.sourceId),
    direction: input.sourceKind === "revenue" ? "revenue" : "expense",
    archivedAt: input.archivedAt ?? null,
  };
  assertLedgerPosting(posting);
  return posting;
}

export function assertLedgerPosting(posting: LedgerPosting): void {
  if (posting.id !== ledgerEntryId(posting.sourceKind, posting.sourceId)) {
    throw new Error("Ledger ID must identify its canonical financial source.");
  }
  assertDateOnly(posting.postedOn);
  assertMoneySnapshot(posting);
  if (posting.originalAmountMinor <= 0) throw new Error("A posting must have a positive original amount.");
  const direction = posting.sourceKind === "revenue" ? "revenue" : "expense";
  if (posting.direction !== direction) throw new Error("Posting direction conflicts with its source kind.");
  if (direction === "revenue" && !posting.revenueSourceId) throw new Error("Revenue posting requires a revenue source.");
  if (direction === "expense" && !posting.categoryId) throw new Error("Expense posting requires a category.");
}

function profitMargin(netProfitMinor: number, revenueMinor: number): number | null {
  if (revenueMinor === 0) return null;
  const profit = BigInt(netProfitMinor);
  const numerator = (profit < 0n ? -profit : profit) * 10_000n;
  const denominator = BigInt(revenueMinor);
  const hundredths = numerator / denominator + (2n * (numerator % denominator) >= denominator ? 1n : 0n);
  // A display-only ratio may exceed safe money limits; source money remains exact.
  return Number(profit < 0n ? -hundredths : hundredths) / 100;
}

/** Aggregate ONLY ledgerEntries, never their source registers a second time. */
export function calculateFinancialSummary(input: {
  month: ReportingMonth;
  baseCurrency: CurrencyCode;
  openingFundMinor: number;
  postings: readonly LedgerPosting[];
}): FinancialSummary {
  assertReportingMonth(input.month);
  assertCurrency(input.baseCurrency);
  assertMinorAmount(input.openingFundMinor);
  const seen = new Set<string>();
  const expenses: number[] = [];
  const revenue: number[] = [];
  for (const posting of input.postings) {
    assertLedgerPosting(posting);
    if (seen.has(posting.id)) throw new Error("Duplicate financial source in ledger input.");
    seen.add(posting.id);
    if (posting.archivedAt !== null || reportingMonthOf(posting.postedOn) !== input.month) continue;
    if (posting.baseCurrency !== input.baseCurrency) throw new Error("Cannot aggregate different historical base currencies.");
    (posting.direction === "revenue" ? revenue : expenses).push(posting.baseAmountMinor);
  }
  const totalRevenueMinor = sumMinorAmounts(revenue);
  const totalExpensesMinor = sumMinorAmounts(expenses);
  const netProfitMinor = sumMinorAmounts([totalRevenueMinor, -totalExpensesMinor]);
  return {
    month: input.month,
    baseCurrency: input.baseCurrency,
    openingFundMinor: input.openingFundMinor,
    totalRevenueMinor,
    totalExpensesMinor,
    remainingOpeningFundMinor: sumMinorAmounts([input.openingFundMinor, -totalExpensesMinor]),
    netProfitMinor,
    closingBalanceMinor: sumMinorAmounts([input.openingFundMinor, totalRevenueMinor, -totalExpensesMinor]),
    profitMarginPercent: profitMargin(netProfitMinor, totalRevenueMinor),
  };
}

export function assertBaseCurrencyChangeAllowed(
  current: CurrencyCode,
  next: CurrencyCode,
  hasFinancialHistory: boolean,
): void {
  assertCurrency(current);
  assertCurrency(next);
  if (current !== next && hasFinancialHistory) {
    throw new Error("Base currency is locked after the first monetary record; use an explicit audited migration.");
  }
}
