import "server-only";

import { createHash } from "node:crypto";
import type { CreateExpenseInput } from "./schema";

/**
 * Stable canonical hash of the validated input fields that define a unique
 * financial intent. Excludes actor identity, timestamps, and idempotencyKey
 * itself so retries by the same user with the same key and body are safe.
 *
 * A different canonical hash for the same key signals a conflicting request
 * (user changed the amount/date after a timeout). Return 409 in that case.
 */
export function canonicalExpenseHash(input: CreateExpenseInput): string {
  const stable = {
    title: input.title,
    amount: input.amount,
    currency: input.currency,
    categoryId: input.categoryId,
    date: input.date,
    frequency: input.frequency,
    notes: input.notes,
    attachmentIds: [...input.attachmentIds].sort(),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}
