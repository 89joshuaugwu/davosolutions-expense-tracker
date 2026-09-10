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

export const createTransportSchema = z
  .object({
    date: z.string().refine(isValidIsoDate, { message: "Invalid date format (YYYY-MM-DD)" }),
    categoryId: z.string().min(1, "Category is required"),
    currency: z
      .string()
      .refine((val): val is CurrencyCode => val in CURRENCIES, { message: "Invalid currency code" }),
    
    morningAmount: amountString.optional().or(z.literal("")),
    eveningAmount: amountString.optional().or(z.literal("")),
    extraAmount: amountString.optional().or(z.literal("")),
    extraReason: z.string().max(250, "Reason too long").optional(),

    notes: z.string().max(1000, "Notes too long").optional(),
    attachmentIds: z.array(z.string()).max(5, "Too many attachments").optional(),
    idempotencyKey: z.string().min(10, "Idempotency key required"),
  })
  .refine(
    (data) => {
      const m = data.morningAmount || "0";
      const e = data.eveningAmount || "0";
      const x = data.extraAmount || "0";
      return m !== "0" || e !== "0" || x !== "0";
    },
    { message: "At least one transport amount must be greater than zero", path: ["morningAmount"] }
  )
  .refine(
    (data) => {
      const x = data.extraAmount || "0";
      if (x !== "0" && (!data.extraReason || !data.extraReason.trim())) {
        return false;
      }
      return true;
    },
    { message: "Reason is required when extra amount is provided", path: ["extraReason"] }
  );

export const correctTransportSchema = z.object({
  action: z.enum(["archive", "correct"]),
  reason: z.string().min(3, "Reason required").max(1000, "Reason too long"),
  expectedRevision: z.number().int().min(1),
  // When action is "correct", future updates will pass the full updated object here.
  // We start with "archive" only for now, mirroring expenses/salaries.
});

export type CreateTransportDto = z.infer<typeof createTransportSchema>;
export type CorrectTransportDto = z.infer<typeof correctTransportSchema>;

export function parseTransportAmounts(
  morning: string | undefined,
  evening: string | undefined,
  extra: string | undefined,
  currency: CurrencyCode
) {
  const cDef = CURRENCIES[currency];
  if (!cDef) throw new Error("Invalid currency");

  const mMinor = parseAmountToMinor(morning || "0", currency, { allowZero: true });
  const eMinor = parseAmountToMinor(evening || "0", currency, { allowZero: true });
  const xMinor = parseAmountToMinor(extra || "0", currency, { allowZero: true });

  const totalMinor = mMinor + eMinor + xMinor;
  if (totalMinor <= 0) {
    throw new Error("Total transport amount must be positive");
  }

  return { mMinor, eMinor, xMinor, totalMinor };
}
