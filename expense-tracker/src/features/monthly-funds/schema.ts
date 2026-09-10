import { z } from "zod";
import { assertReportingMonth } from "@/domain/dates";
import { CURRENCIES, type CurrencyCode, parseAmountToMinor } from "@/domain/money";

function isValidMonth(val: string): boolean {
  try {
    assertReportingMonth(val);
    return true;
  } catch {
    return false;
  }
}

const amountString = z.string().regex(/^\d+(\.\d{1,2})?$/, {
  message: "Amount must be a non-negative number with up to 2 decimal places",
});

export const createMonthlyFundSchema = z.object({
  month: z.string().refine(isValidMonth, { message: "Invalid month format (YYYY-MM)" }),
  originalAmount: amountString,
  currency: z.string().refine((val): val is CurrencyCode => val in CURRENCIES, { message: "Invalid currency code" }),
  source: z.string().max(100).optional().default(""),
  notes: z.string().max(1000).optional(),
  idempotencyKey: z.string().min(10, "Idempotency key required"),
});

export type CreateMonthlyFundDto = z.infer<typeof createMonthlyFundSchema>;

export function parseFundAmount(amount: string, currency: CurrencyCode) {
  const minor = parseAmountToMinor(amount, currency, { allowZero: true });
  if (minor < 0) throw new Error("Fund amount cannot be negative");
  return minor;
}
