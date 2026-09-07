import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "../firebase/admin";
import { auditEventSchema, type AuditEvent } from "./audit-model";

/**
 * Append only: transaction.create can never replace an existing audit entry.
 * A financial service MUST call this inside the same transaction as its mutation.
 * This helper does not authorize callers: service entry points authorize first.
 */
export function appendAuditInTransaction(transaction: Transaction, event: AuditEvent): string {
  const validated = auditEventSchema.parse(event);
  const ref = getAdminDb().collection("auditLogs").doc();
  transaction.create(ref, { ...validated, timestamp: FieldValue.serverTimestamp() });
  return ref.id;
}

/** For events without a financial mutation, such as authentication. */
export async function appendAudit(event: AuditEvent): Promise<string> {
  return getAdminDb().runTransaction(async (transaction) => appendAuditInTransaction(transaction, event));
}
