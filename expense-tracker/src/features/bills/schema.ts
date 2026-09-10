import { z } from "zod";
import { assertDateOnly } from "@/domain/dates";
import { CURRENCIES, type CurrencyCode, parseAmountToMinor } from "@/domain/money";

function isValidIsoDate(val: string): boolean {
  try {
    assertDateOnly(val);
    return true;
  } catch {
    return false;
  }
}

const amountString = z.string().regex(/^\d+(\.\d{1,2})?$/, {
  message: "Amount must be a positive number with up to 2 decimal places",
});

export const createBillSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  provider: z.string().min(2, "Provider must be at least 2 characters").max(100),
  categoryId: z.string().min(1, "Category is required"),
  expectedAmount: amountString,
  currency: z.string().refine((val): val is CurrencyCode => val in CURRENCIES, { message: "Invalid currency code" }),
  frequency: z.enum(["one_time", "daily", "monthly", "yearly"]),
  nextDueDate: z.string().refine(isValidIsoDate, { message: "Invalid date format (YYYY-MM-DD)" }),
  reminderDays: z.array(z.number().int().min(1).max(30)).max(5).default([7, 3, 1]),
  notes: z.string().max(1000).optional(),
  attachmentIds: z.array(z.string()).max(5).optional(),
  idempotencyKey: z.string().min(10, "Idempotency key required"),
});

export const payBillSchema = z.object({
  occurrenceDate: z.string().refine(isValidIsoDate, { message: "Invalid date format (YYYY-MM-DD)" }),
  paymentDate: z.string().refine(isValidIsoDate, { message: "Invalid date format (YYYY-MM-DD)" }),
  actualAmount: amountString,
  notes: z.string().max(1000).optional(),
  attachmentIds: z.array(z.string()).max(5).optional(),
  idempotencyKey: z.string().min(10, "Idempotency key required"),
});

export const updateBillStatusSchema = z.object({
  status: z.enum(["active", "paused", "completed"]),
  reason: z.string().min(3).max(1000),
  expectedRevision: z.number().int().min(1),
});

export type CreateBillDto = z.infer<typeof createBillSchema>;
export type PayBillDto = z.infer<typeof payBillSchema>;
export type UpdateBillStatusDto = z.infer<typeof updateBillStatusSchema>;

export function parseBillAmount(amount: string, currency: CurrencyCode) {
  const minor = parseAmountToMinor(amount, currency, { allowZero: false });
  if (minor <= 0) throw new Error("Bill amount must be positive");
  return minor;
}
