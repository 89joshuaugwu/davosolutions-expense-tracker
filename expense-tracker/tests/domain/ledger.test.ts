import assert from "node:assert/strict";
import test from "node:test";
import {
  assertBaseCurrencyChangeAllowed, billPaymentId, calculateFinancialSummary,
  createLedgerPosting, ledgerEntryId, type LedgerPosting, type PostingSourceKind,
} from "../../src/domain/ledger";
import { createMoneySnapshot, type CurrencyCode } from "../../src/domain/money";
import { postingForBillPayment, postingForSalary, postingForTransport } from "../../src/domain/postings";
import type { BillPayment, SalaryLog, TransportLog } from "../../src/domain/models";

function posting(sourceKind: PostingSourceKind, sourceId: string, amount: string, extras: Partial<LedgerPosting> = {}): LedgerPosting {
  return {
    ...createLedgerPosting({
      ...createMoneySnapshot({ amount, currency: "NGN", baseCurrency: "NGN", exchangeRate: "1", rateDate: "2026-09-04" }),
      sourceKind, sourceId, postedOn: "2026-09-04",
      categoryId: sourceKind === "revenue" ? null : "operations",
      revenueSourceId: sourceKind === "revenue" ? "consulting" : null,
    }),
    ...extras,
  };
}

const metadata = {
  createdBy: "user1", createdAt: "2026-09-04T10:00:00.000Z", updatedAt: "2026-09-04T10:00:00.000Z",
  archivedAt: null, archivedBy: null, revision: 1, notes: "", attachments: [], visibleToUserIds: [],
};

test("fund, income, expenses, profit and closing balance remain separate", () => {
  const result = calculateFinancialSummary({
    month: "2026-09", baseCurrency: "NGN", openingFundMinor: 100_000_00,
    postings: [posting("revenue", "r1", "70000"), posting("expense", "e1", "30000"), posting("salary", "s1", "10000")],
  });
  assert.deepEqual(result, {
    month: "2026-09", baseCurrency: "NGN", openingFundMinor: 100_000_00,
    totalRevenueMinor: 70_000_00, totalExpensesMinor: 40_000_00, remainingOpeningFundMinor: 60_000_00,
    netProfitMinor: 30_000_00, closingBalanceMinor: 130_000_00, profitMarginPercent: 42.86,
  });
});

test("zero revenue has no margin; spending may exceed opening funds", () => {
  const result = calculateFinancialSummary({
    month: "2026-09", baseCurrency: "NGN", openingFundMinor: 0, postings: [posting("expense", "e1", "10")],
  });
  assert.equal(result.profitMarginPercent, null);
  assert.equal(result.netProfitMinor, -1000);
  assert.equal(result.remainingOpeningFundMinor, -1000);
  assert.equal(result.closingBalanceMinor, -1000);
});

test("archives and other calendar months do not affect the selected month's totals", () => {
  const result = calculateFinancialSummary({
    month: "2026-09", baseCurrency: "NGN", openingFundMinor: 0,
    postings: [posting("expense", "old", "10", { postedOn: "2026-08-31" }),
      posting("expense", "deleted", "20", { archivedAt: "2026-09-05T10:00:00Z" }), posting("expense", "live", "5")],
  });
  assert.equal(result.totalExpensesMinor, 500);
});

test("duplicate source records and invented posting IDs cannot inflate aggregates", () => {
  const bill = posting("bill_payment", "bill1__2026-09-04", "100");
  const summarize = (postings: readonly LedgerPosting[]) => calculateFinancialSummary({
    month: "2026-09", baseCurrency: "NGN", openingFundMinor: 0, postings,
  });
  assert.throws(() => summarize([bill, bill]), /Duplicate/);
  assert.throws(() => summarize([{ ...bill, id: "another-id" }]), /canonical/);
  assert.throws(() => summarize([{ ...bill, direction: "revenue" }]), /direction/);
  assert.equal(billPaymentId("bill1", "2026-09-04"), billPaymentId("bill1", "2026-09-04"));
  assert.throws(() => billPaymentId("../bill", "2026-09-04"));
});

test("mixed historical base currencies and overflow fail closed", () => {
  const foreignBase = createLedgerPosting({
    ...createMoneySnapshot({ amount: "1", currency: "USD", baseCurrency: "USD", exchangeRate: "1", rateDate: "2026-09-04" }),
    sourceKind: "expense", sourceId: "usd1", postedOn: "2026-09-04", categoryId: "operations", revenueSourceId: null,
  });
  assert.throws(() => calculateFinancialSummary({
    month: "2026-09", baseCurrency: "NGN", openingFundMinor: 0, postings: [foreignBase],
  }), /historical base/);
  assert.throws(() => calculateFinancialSummary({
    month: "2026-09", baseCurrency: "NGN", openingFundMinor: Number.MAX_SAFE_INTEGER,
    postings: [posting("revenue", "r1", "0.01")],
  }), /safe minor-unit/);
  assert.throws(() => calculateFinancialSummary({
    month: "2026-09", baseCurrency: "JPY" as CurrencyCode, openingFundMinor: 0, postings: [],
  }));
});

test("a pending salary posts nothing; a paid salary belongs to its payment month", () => {
  const pending: SalaryLog = {
    ...metadata, ...createMoneySnapshot({ amount: "100", currency: "NGN", baseCurrency: "NGN", exchangeRate: "1", rateDate: "2026-09-04" }),
    id: "salary1", kind: "salary", workerName: "Worker", workerRef: null,
    period: "2026-08", categoryId: "salary", status: "pending", paymentDate: null,
  };
  assert.equal(postingForSalary(pending), null);
  const paid = postingForSalary({ ...pending, status: "paid", paymentDate: "2026-09-04" });
  assert.ok(paid);
  assert.equal(paid.postedOn, "2026-09-04");
  assert.equal(paid.id, "salary:salary1");
});

test("transport totals are checked and converted once after combining original components", () => {
  const record: TransportLog = {
    ...metadata, ...createMoneySnapshot({ amount: "0.02", currency: "USD", baseCurrency: "NGN", exchangeRate: "0.5", rateDate: "2026-09-04" }),
    id: "transport1", kind: "transport", date: "2026-09-04", categoryId: "transport",
    morningAmountMinor: 1, eveningAmountMinor: 1, extraAmountMinor: 0, extraReason: "",
  };
  assert.equal(postingForTransport(record).baseAmountMinor, 1);
  assert.throws(() => postingForTransport({ ...record, eveningAmountMinor: 2 }), /must equal/);
  assert.throws(() => postingForTransport({ ...record, morningAmountMinor: 0, extraAmountMinor: 1 }), /requires a reason/);
});

test("a bill payment links exactly one canonical posting to one scheduled occurrence", () => {
  const id = billPaymentId("hosting", "2026-09-01");
  const payment: BillPayment = {
    ...metadata, ...createMoneySnapshot({ amount: "50", currency: "NGN", baseCurrency: "NGN", exchangeRate: "1", rateDate: "2026-09-04" }),
    id, billId: "hosting", occurrenceDate: "2026-09-01", paymentDate: "2026-09-04",
    categoryId: "bills", ledgerEntryId: ledgerEntryId("bill_payment", id),
  };
  assert.equal(postingForBillPayment(payment).id, payment.ledgerEntryId);
  assert.throws(() => postingForBillPayment({ ...payment, id: "random-retry" }), /scheduled occurrence/);
  assert.throws(() => postingForBillPayment({ ...payment, ledgerEntryId: "wrong" }), /canonical posting/);
});

test("base currency changes are locked after any monetary history", () => {
  assert.doesNotThrow(() => assertBaseCurrencyChangeAllowed("NGN", "USD", false));
  assert.doesNotThrow(() => assertBaseCurrencyChangeAllowed("NGN", "NGN", true));
  assert.throws(() => assertBaseCurrencyChangeAllowed("NGN", "USD", true), /locked/);
});
