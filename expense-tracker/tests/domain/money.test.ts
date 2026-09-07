import assert from "node:assert/strict";
import test from "node:test";
import {
  assertMoneySnapshot, convertToBaseMinor, createMoneySnapshot, formatMoney,
  parseAmountToMinor, sumMinorAmounts, toDecimalAmount,
} from "../../src/domain/money";

test("scope example retains USD 30 and the historical 1600 NGN rate", () => {
  const snapshot = createMoneySnapshot({
    amount: "30", currency: "USD", baseCurrency: "NGN", exchangeRate: "1600", rateDate: "2026-09-04",
  });
  assert.deepEqual(snapshot, {
    originalAmountMinor: 3000, currency: "USD", baseCurrency: "NGN",
    exchangeRateSnapshot: "1600", rateDate: "2026-09-04", baseAmountMinor: 4_800_000,
  });
  assert.equal(formatMoney(snapshot.baseAmountMinor, "NGN"), "₦48,000.00");
  const newer = createMoneySnapshot({
    amount: "30", currency: "USD", baseCurrency: "NGN", exchangeRate: "1700", rateDate: "2026-09-05",
  });
  assert.equal(newer.baseAmountMinor, 5_100_000);
  assert.equal(snapshot.baseAmountMinor, 4_800_000);
});

test("decimal input never acquires floating point errors", () => {
  assert.equal(parseAmountToMinor("0.29"), 29);
  assert.equal(parseAmountToMinor("10.1"), 1010);
  assert.equal(sumMinorAmounts([parseAmountToMinor("0.1"), parseAmountToMinor("0.2")]), 30);
  assert.equal(parseAmountToMinor("0", "NGN", { allowZero: true }), 0);
  assert.equal(toDecimalAmount(-1), "-0.01");
});

test("ambiguous, signed, non-finite, scientific and over-precise amount input is rejected", () => {
  for (const value of ["", " ", " 1", "1 ", "01", "-1", "+1", "1e2", "1,000", "1.001", ".5", "1.", "NaN", "Infinity", "0", "0.00"]) {
    assert.throws(() => parseAmountToMinor(value), value);
  }
  assert.throws(() => parseAmountToMinor(12 as unknown as string));
  assert.throws(() => parseAmountToMinor("1", "JPY" as "NGN"));
});

test("half-up conversion rounds precisely at the base minor unit", () => {
  assert.equal(convertToBaseMinor(1, "USD", "NGN", "0.5"), 1);
  assert.equal(convertToBaseMinor(1, "USD", "NGN", "0.499999999999"), 0);
  assert.equal(convertToBaseMinor(3, "USD", "NGN", "0.5"), 2);
  assert.equal(convertToBaseMinor(29, "USD", "NGN", "1.5"), 44);
  assert.equal(convertToBaseMinor(29, "NGN", "NGN", "1.000"), 29);
});

test("FX rejects invalid rates and same-currency conversion other than identity", () => {
  for (const rate of ["0", "0.00", "-1", "1e3", "NaN", "Infinity", ".5", "1.", " 1", "1.0000000000001"]) {
    assert.throws(() => convertToBaseMinor(100, "USD", "NGN", rate), rate);
  }
  assert.throws(() => convertToBaseMinor(100, "USD", "NGN", 1600 as unknown as string));
  assert.throws(() => convertToBaseMinor(100, "NGN", "NGN", "1600"));
  assert.throws(() => convertToBaseMinor(-1, "USD", "NGN", "1"));
});

test("safe-integer boundaries and formatting preserve the final minor unit", () => {
  assert.equal(parseAmountToMinor("90071992547409.91"), Number.MAX_SAFE_INTEGER);
  assert.equal(toDecimalAmount(Number.MAX_SAFE_INTEGER), "90071992547409.91");
  assert.equal(formatMoney(Number.MAX_SAFE_INTEGER, "USD"), "$90,071,992,547,409.91");
  assert.equal(formatMoney(-1), "−₦0.01");
  assert.throws(() => parseAmountToMinor("90071992547409.92"));
  assert.throws(() => convertToBaseMinor(Number.MAX_SAFE_INTEGER, "USD", "NGN", "2"));
  assert.throws(() => sumMinorAmounts([Number.MAX_SAFE_INTEGER, 1]));
  assert.throws(() => sumMinorAmounts([Number.MIN_SAFE_INTEGER, -1]));
  assert.throws(() => sumMinorAmounts([NaN]));
  assert.throws(() => sumMinorAmounts([1.2]));
});

test("snapshot validation catches tampered base totals and impossible rate dates", () => {
  const snapshot = createMoneySnapshot({
    amount: "1", currency: "USD", baseCurrency: "NGN", exchangeRate: "1600", rateDate: "2026-09-04",
  });
  assert.throws(() => assertMoneySnapshot({ ...snapshot, baseAmountMinor: 1 }));
  assert.throws(() => createMoneySnapshot({
    amount: "1", currency: "USD", baseCurrency: "NGN", exchangeRate: "1600", rateDate: "2026-02-29",
  }));
});
