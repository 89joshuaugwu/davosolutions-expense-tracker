import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";

export interface IdempotencyReceipt {
  /** The SHA-256 canonical hash of the validated input body. */
  readonly canonicalHash: string;
  /** The Firestore document ID of the created record (e.g. an expense ID). */
  readonly resultId: string;
  /** ISO timestamp when this receipt was created. */
  readonly createdAt: string;
}

/**
 * Checks for an existing idempotency receipt.
 *
 * - `existing`: null = first request; string = the previously created record ID.
 * - `conflict`: true = same key, different canonical body → return 409.
 */
export async function checkIdempotency(
  key: string,
  canonicalHash: string,
): Promise<{ existing: string | null; conflict: boolean }> {
  if (!key || !/^[0-9a-f-]{36}$/.test(key)) {
    throw new Error("Idempotency key must be a valid UUID.");
  }
  const db = getAdminDb();
  const snapshot = await db.collection("idempotencyReceipts").doc(key).get();
  if (!snapshot.exists) return { existing: null, conflict: false };

  const data = snapshot.data()!;
  if (data["canonicalHash"] !== canonicalHash) return { existing: null, conflict: true };
  return { existing: String(data["resultId"]), conflict: false };
}

/**
 * Persists an idempotency receipt inside an open transaction.
 * Must be called AFTER all reads in the transaction and alongside the record create.
 * Uses transaction.create() so a concurrent race that wins first will cause the second
 * transaction to fail with ALREADY_EXISTS, which is safe to retry.
 */
export function setIdempotencyReceiptInTransaction(
  transaction: Transaction,
  key: string,
  canonicalHash: string,
  resultId: string,
): void {
  const db = getAdminDb();
  const ref = db.collection("idempotencyReceipts").doc(key);
  transaction.create(ref, {
    canonicalHash,
    resultId,
    createdAt: FieldValue.serverTimestamp(),
  });
}
