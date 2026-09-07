/** A business calendar date, deliberately independent of a browser/server timezone. */
export type DateOnly = string;
/** One month, formatted YYYY-MM. Also the unique monthlyFunds document ID. */
export type ReportingMonth = string;

export function assertDateOnly(value: string): asserts value is DateOnly {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new Error("Date must use YYYY-MM-DD.");
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]!) {
    throw new Error("Date must be an actual calendar day.");
  }
}

export function assertReportingMonth(value: string): asserts value is ReportingMonth {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
    throw new Error("Month must use YYYY-MM with a valid year and month.");
  }
}

export function reportingMonthOf(date: DateOnly): ReportingMonth {
  assertDateOnly(date);
  return date.slice(0, 7);
}

export function monthlyFundId(month: ReportingMonth): string {
  assertReportingMonth(month);
  return month;
}
