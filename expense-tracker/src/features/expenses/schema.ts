import { z } from "zod";

/**
 * Frequency is descriptive only; it does not auto-post future expenses.
 * Stored on the record for reporting/filtering purposes.
 */
export const frequencySchema = z.enum(["one_time", "daily", "monthly", "yearly"]);

/**
 * Strict input schema for POST /api/expenses.
 * All monetary amounts are decimal strings; the server computes minor units and base amounts.
 * The client must never supply baseAmountMinor, actor, timestamps, or revision.
 */
export const createExpenseSchema = z
  .object({
    /** Short meaningful label for the expense. */
    title: z.string().trim().min(1, "Title is required.").max(200, "Title must be 200 characters or fewer."),
    /** Positive decimal string e.g. "1500.00". The server parses this to minor units. */
    amount: z
      .string()
      .trim()
      .regex(/^(0|[1-9]\d*)(?:\.\d+)?$/, "Enter a valid positive number.")
      .max(32, "Amount value is too long."),
    /** ISO 4217 code of the entry currency. Must be in the company's enabled list. */
    currency: z.string().trim().min(1, "Currency is required.").max(10),
    /** Must reference an active category document ID. */
    categoryId: z.string().trim().min(1, "Category is required.").max(128),
    /** Business date of the expense in YYYY-MM-DD. Never trust this for financial aggregation timestamps. */
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must use YYYY-MM-DD."),
    frequency: frequencySchema,
    /** Optional clarifying text attached to the record for audit evidence. */
    notes: z.string().max(2000, "Notes must be 2000 characters or fewer.").default(""),
    /**
     * Client-generated UUID before submit. Prevents double-click duplicates.
     * Same key + same canonical body → return existing result.
     * Same key + different canonical body → 409 Conflict.
     */
    idempotencyKey: z.string().uuid("Idempotency key must be a UUID."),
    /**
     * Attachment IDs pre-authorised by the upload intent flow.
     */
    attachmentIds: z.array(z.string().max(128)).max(5, "Maximum 5 attachments allowed.").default([]),
  })
  .strict();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

/** Validated correction body for PATCH /api/expenses/:id (Super Admin only). */
export const correctExpenseSchema = z
  .object({
    /** Must be supplied for every correction; stored in audit log. */
    reason: z.string().trim().min(3, "Reason must be at least 3 characters.").max(1000),
    /** Reject stale concurrent writes. Must match the stored revision. */
    expectedRevision: z.number().int().nonnegative(),
    /** Fields the Super Admin is correcting. Only listed fields are patchable. */
    title: z.string().trim().min(1).max(200).optional(),
    notes: z.string().max(2000).optional(),
    categoryId: z.string().trim().min(1).max(128).optional(),
    date: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    frequency: frequencySchema.optional(),
  })
  .strict()
  .refine(
    (v) =>
      v.title !== undefined ||
      v.notes !== undefined ||
      v.categoryId !== undefined ||
      v.date !== undefined ||
      v.frequency !== undefined,
    "At least one field must be corrected.",
  );

export type CorrectExpenseInput = z.infer<typeof correctExpenseSchema>;

/** Archive body for DELETE /api/expenses/:id (Super Admin only). Soft-delete only. */
export const archiveExpenseSchema = z
  .object({
    reason: z.string().trim().min(3, "Reason must be at least 3 characters.").max(1000),
    expectedRevision: z.number().int().nonnegative(),
  })
  .strict();

export type ArchiveExpenseInput = z.infer<typeof archiveExpenseSchema>;
