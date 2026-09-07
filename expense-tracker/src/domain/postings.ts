import { assertDateOnly, assertReportingMonth } from "./dates";
import { billPaymentId, createLedgerPosting, ledgerEntryId, type LedgerPosting } from "./ledger";
import { assertMinorAmount, assertMoneySnapshot, sumMinorAmounts, type MoneySnapshot } from "./money";
import type { BillPayment, ExpenseRecord, RevenueRecord, SalaryLog, TransportLog } from "./models";

function snapshotOf(record: MoneySnapshot): MoneySnapshot {
  assertMoneySnapshot(record);
  return {
    originalAmountMinor: record.originalAmountMinor,
    currency: record.currency,
    baseCurrency: record.baseCurrency,
    exchangeRateSnapshot: record.exchangeRateSnapshot,
    rateDate: record.rateDate,
    baseAmountMinor: record.baseAmountMinor,
  };
}

export function postingForExpense(record: ExpenseRecord): LedgerPosting {
  return createLedgerPosting({
    ...snapshotOf(record), sourceKind: "expense", sourceId: record.id, postedOn: record.date,
    categoryId: record.categoryId, revenueSourceId: null, archivedAt: record.archivedAt,
  });
}

/** Provisional cash-basis policy: a pending salary is not an incurred cash expense. */
export function postingForSalary(record: SalaryLog): LedgerPosting | null {
  assertReportingMonth(record.period);
  const snapshot = snapshotOf(record);
  if (record.paymentDate !== null) assertDateOnly(record.paymentDate);
  if (record.status === "pending") return null;
  if (record.status !== "paid" || record.paymentDate === null) throw new Error("Paid salary requires a payment date.");
  return createLedgerPosting({
    ...snapshot, sourceKind: "salary", sourceId: record.id, postedOn: record.paymentDate,
    categoryId: record.categoryId, revenueSourceId: null, archivedAt: record.archivedAt,
  });
}

export function postingForTransport(record: TransportLog): LedgerPosting {
  const components = [record.morningAmountMinor, record.eveningAmountMinor, record.extraAmountMinor];
  components.forEach((amount) => assertMinorAmount(amount));
  if (sumMinorAmounts(components) !== record.originalAmountMinor) {
    throw new Error("Transport original amount must equal its morning, evening, and extra components.");
  }
  if (record.extraAmountMinor > 0 && !record.extraReason.trim()) throw new Error("Extra transport requires a reason.");
  return createLedgerPosting({
    ...snapshotOf(record), sourceKind: "transport", sourceId: record.id, postedOn: record.date,
    categoryId: record.categoryId, revenueSourceId: null, archivedAt: record.archivedAt,
  });
}

export function postingForBillPayment(record: BillPayment): LedgerPosting {
  if (record.id !== billPaymentId(record.billId, record.occurrenceDate)) {
    throw new Error("Bill payment ID must identify the bill and scheduled occurrence.");
  }
  if (record.ledgerEntryId !== ledgerEntryId("bill_payment", record.id)) {
    throw new Error("Bill payment ledger reference must identify its canonical posting.");
  }
  return createLedgerPosting({
    ...snapshotOf(record), sourceKind: "bill_payment", sourceId: record.id, postedOn: record.paymentDate,
    categoryId: record.categoryId, revenueSourceId: null, archivedAt: record.archivedAt,
  });
}

export function postingForRevenue(record: RevenueRecord): LedgerPosting {
  return createLedgerPosting({
    ...snapshotOf(record), sourceKind: "revenue", sourceId: record.id, postedOn: record.date,
    categoryId: null, revenueSourceId: record.sourceId, archivedAt: record.archivedAt,
  });
}
