import assert from "node:assert/strict";
import test from "node:test";
import { assertDateOnly, assertReportingMonth, monthlyFundId, reportingMonthOf } from "../../src/domain/dates";

test("business dates validate real days including century leap-year rules", () => {
  for (const value of ["2024-02-29", "2000-02-29", "2026-09-30", "0001-01-01", "9999-12-31"]) {
    assert.doesNotThrow(() => assertDateOnly(value));
  }
  for (const value of ["2026-02-29", "1900-02-29", "2026-04-31", "2026-13-01", "2026-00-01", "2026-01-00", "0000-01-01", "26-01-01", "2026-9-07", "2026-09-07T00:00:00Z"]) {
    assert.throws(() => assertDateOnly(value), value);
  }
});

test("calendar months are canonical document IDs with no timezone rollover", () => {
  assert.equal(reportingMonthOf("2026-09-01"), "2026-09");
  assert.equal(monthlyFundId("2026-09"), "2026-09");
  for (const value of ["2026-9", "2026-00", "2026-13", "0000-01", "2026-09-01"]) {
    assert.throws(() => assertReportingMonth(value), value);
  }
});
