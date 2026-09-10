import { createHash } from "node:crypto";
import type { CreateSalaryInput } from "./schema";

export async function canonicalSalaryHash(input: CreateSalaryInput): Promise<string> {
  // Sort attachment IDs to ensure order doesn't affect hash
  const sortedAttachments = [...(input.attachmentIds || [])].sort();

  const canonicalObj = {
    workerName: input.workerName.trim(),
    workerRef: input.workerRef ? input.workerRef.trim() : null,
    period: input.period,
    amount: input.amount,
    currency: input.currency,
    status: input.status,
    paymentDate: input.paymentDate || null,
    categoryId: input.categoryId,
    notes: input.notes.trim(),
    attachments: sortedAttachments,
  };

  const canonicalString = JSON.stringify(canonicalObj);
  return createHash("sha256").update(canonicalString).digest("hex");
}
