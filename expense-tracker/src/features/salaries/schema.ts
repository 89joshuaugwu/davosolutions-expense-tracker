import { z } from "zod";
import { CURRENCIES } from "../../domain/money";
import { assertDateOnly } from "../../domain/dates";

function isValidDate(val: string) {
  try { assertDateOnly(val); return true; } catch { return false; }
}

const amountRegex = /^(0|[1-9]\d*)(?:\.\d+)?$/;

export const createSalarySchema = z
  .object({
    workerName: z.string().min(1, "Worker name is required.").max(100, "Worker name is too long."),
    workerRef: z.string().max(100).nullable().default(null),
    period: z.string().regex(/^\d{4}-\d{2}$/, "Period must be YYYY-MM format."),
    amount: z
      .string()
      .min(1, "Amount is required.")
      .regex(amountRegex, "Amount must be a positive number without leading zeros.")
      .refine((val) => {
        const parsed = Number(val);
        return !isNaN(parsed) && isFinite(parsed) && parsed >= 0;
      }, "Amount must be a valid positive number."),
    currency: z
      .string()
      .min(1, "Currency is required.")
      .refine((val) => Object.hasOwn(CURRENCIES, val), "Unsupported currency."),
    status: z.enum(["pending", "paid"], {
      error: "Status must be pending or paid."
    }),
    paymentDate: z.string().optional(),
    categoryId: z.string().min(1, "Category is required.").max(128),
    notes: z.string().max(2000, "Notes are too long.").default(""),
    idempotencyKey: z.string().uuid("Idempotency key must be a UUID."),
    attachmentIds: z.array(z.string().max(128)).max(5, "Maximum 5 attachments allowed.").default([]),
  })
  .strict()
  .refine(
    (data) => {
      if (data.status === "paid" && !data.paymentDate) return false;
      return true;
    },
    {
      message: "Payment date is required when status is paid.",
      path: ["paymentDate"],
    }
  )
  .refine(
    (data) => {
      if (data.paymentDate) {
        return isValidDate(data.paymentDate);
      }
      return true;
    },
    {
      message: "Payment date must be a valid YYYY-MM-DD date.",
      path: ["paymentDate"],
    }
  )
  .refine(
    (data) => {
      if (data.status === "pending" && data.paymentDate) return false;
      return true;
    },
    {
      message: "Payment date cannot be set when status is pending.",
      path: ["paymentDate"],
    }
  );

export type CreateSalaryInput = z.infer<typeof createSalarySchema>;

export const correctSalarySchema = z
  .object({
    workerName: z.string().min(1).max(100).optional(),
    period: z.string().regex(/^\d{4}-\d{2}$/).optional(),
    amount: z.string().regex(amountRegex).optional(),
    currency: z.string().refine((val) => Object.hasOwn(CURRENCIES, val)).optional(),
    categoryId: z.string().min(1).max(128).optional(),
    notes: z.string().max(2000).optional(),
    paymentDate: z.string().optional(),
    status: z.enum(["pending", "paid"]).optional(),
    reason: z.string().min(10, "A detailed reason (at least 10 characters) is required for correction.").max(1000),
    expectedRevision: z.number().int().nonnegative("Expected revision must be a non-negative integer."),
  })
  .strict()
  .refine(
    (data) => {
      if (data.paymentDate) return isValidDate(data.paymentDate);
      return true;
    },
    { message: "Payment date must be a valid YYYY-MM-DD date.", path: ["paymentDate"] }
  )
  .refine(
    (data) => {
      const hasUpdates = [
        data.workerName,
        data.period,
        data.amount,
        data.currency,
        data.categoryId,
        data.notes,
        data.paymentDate,
        data.status,
      ].some((v) => v !== undefined);
      return hasUpdates;
    },
    { message: "At least one field must be provided to correct.", path: ["reason"] } // Attach to reason to show form-level error
  );

export type CorrectSalaryInput = z.infer<typeof correctSalarySchema>;

export const archiveSalarySchema = z
  .object({
    reason: z.string().min(10, "A detailed reason (at least 10 characters) is required for archiving.").max(1000),
    expectedRevision: z.number().int().nonnegative("Expected revision must be a non-negative integer."),
  })
  .strict();

export type ArchiveSalaryInput = z.infer<typeof archiveSalarySchema>;

export const paySalarySchema = z
  .object({
    paymentDate: z.string().refine((val) => isValidDate(val), "Must be a valid YYYY-MM-DD date."),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export type PaySalaryInput = z.infer<typeof paySalarySchema>;
