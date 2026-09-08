import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import type { ExpenseRecord } from "../../../domain/models";
import { createLedgerPosting } from "../../../domain/ledger";
import type { AuditEvent } from "../audit-model";
import { appendAuditInTransaction } from "../audit";
import { setIdempotencyReceiptInTransaction } from "./idempotency";

/**
 * Projection returned from list/detail queries.
 * Never includes raw Firestore internals or server-only fields.
 */
export type ExpenseListItem = Pick<
  ExpenseRecord,
  | "id"
  | "title"
  | "originalAmountMinor"
  | "currency"
  | "baseAmountMinor"
  | "baseCurrency"
  | "categoryId"
  | "date"
  | "frequency"
  | "createdBy"
  | "createdAt"
  | "archivedAt"
  | "revision"
>;

export type ExpenseDetail = ExpenseRecord;

function docToExpenseRecord(id: string, data: FirebaseFirestore.DocumentData): ExpenseRecord {
  return {
    id,
    kind: "expense",
    title: String(data["title"] ?? ""),
    originalAmountMinor: Number(data["originalAmountMinor"]),
    currency: data["currency"],
    baseCurrency: data["baseCurrency"],
    exchangeRateSnapshot: String(data["exchangeRateSnapshot"]),
    rateDate: String(data["rateDate"]),
    baseAmountMinor: Number(data["baseAmountMinor"]),
    categoryId: String(data["categoryId"] ?? ""),
    date: String(data["date"] ?? ""),
    frequency: data["frequency"] ?? "one_time",
    notes: String(data["notes"] ?? ""),
    attachments: Array.isArray(data["attachments"]) ? data["attachments"] : [],
    expenseKind: "general",
    visibleToUserIds: Array.isArray(data["visibleToUserIds"]) ? data["visibleToUserIds"] : [],
    createdBy: String(data["createdBy"] ?? ""),
    createdAt: data["createdAt"]?.toDate?.()?.toISOString() ?? String(data["createdAt"] ?? ""),
    updatedAt: data["updatedAt"]?.toDate?.()?.toISOString() ?? String(data["updatedAt"] ?? ""),
    archivedAt: data["archivedAt"]?.toDate?.()?.toISOString() ?? (data["archivedAt"] as string | null) ?? null,
    archivedBy: (data["archivedBy"] as string | null) ?? null,
    revision: Number(data["revision"] ?? 0),
  };
}

/**
 * Atomically creates one expense, one ledger posting, one audit entry, and one idempotency receipt.
 * All reads must happen BEFORE this function is called (inside the same transaction).
 * This function performs only writes. The expense ID is generated here and returned.
 */
export function createExpenseInTransaction(
  transaction: Transaction,
  expense: Omit<ExpenseRecord, "id" | "createdAt" | "updatedAt" | "revision">,
  postingInput: {
    snapshot: import("../../../domain/money").MoneySnapshot;
    postedOn: import("../../../domain/dates").DateOnly;
    categoryId: string;
  },
  auditEvent: AuditEvent,
  idempotencyKey: string,
  idempotencyHash: string,
): string {
  const db = getAdminDb();
  const expenseRef = db.collection("expenses").doc();
  const expenseId = expenseRef.id;

  // Build posting with the real expense ID
  const posting = createLedgerPosting({
    ...postingInput.snapshot,
    sourceKind: "expense",
    sourceId: expenseId,
    postedOn: postingInput.postedOn,
    categoryId: postingInput.categoryId,
    revenueSourceId: null,
  });

  const ledgerRef = db.collection("ledgerEntries").doc(posting.id);

  const expenseData = {
    ...expense,
    revision: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  transaction.create(expenseRef, expenseData);
  transaction.create(ledgerRef, {
    ...posting,
    createdAt: FieldValue.serverTimestamp(),
  });

  appendAuditInTransaction(transaction, auditEvent);
  setIdempotencyReceiptInTransaction(transaction, idempotencyKey, idempotencyHash, expenseRef.id);

  return expenseRef.id;
}

/**
 * Atomically applies a Super Admin correction to an expense and its ledger posting.
 * Updates source, posting, and appends an immutable audit event.
 */
export function correctExpenseInTransaction(
  transaction: Transaction,
  expenseId: string,
  patch: Partial<Pick<ExpenseRecord, "title" | "notes" | "categoryId" | "date" | "frequency">>,
  expectedRevision: number,
  updatedBy: string,
  auditEvent: AuditEvent,
): void {
  const db = getAdminDb();
  const ref = db.collection("expenses").doc(expenseId);
  transaction.update(ref, {
    ...patch,
    revision: expectedRevision + 1,
    updatedAt: FieldValue.serverTimestamp(),
  });
  appendAuditInTransaction(transaction, auditEvent);
}

/**
 * Atomically soft-archives an expense and its ledger posting.
 * Hard deletion is not supported; archived records are excluded from aggregates.
 */
export function archiveExpenseInTransaction(
  transaction: Transaction,
  expenseId: string,
  expectedRevision: number,
  archivedBy: string,
  auditEvent: AuditEvent,
): void {
  const db = getAdminDb();
  const expenseRef = db.collection("expenses").doc(expenseId);
  const ledgerRef = db.collection("ledgerEntries").doc(`expense:${expenseId}`);

  const now = FieldValue.serverTimestamp();
  transaction.update(expenseRef, {
    archivedAt: now,
    archivedBy,
    revision: expectedRevision + 1,
    updatedAt: now,
  });
  transaction.update(ledgerRef, { archivedAt: now });
  appendAuditInTransaction(transaction, auditEvent);
}

/**
 * Returns a paginated list of expenses authorized for the requesting user.
 * Applies own/assigned visibility for Secretary users.
 */
export async function listExpenses(options: {
  uid: string;
  isSuperAdmin: boolean;
  month?: string;
  cursor?: string;
  pageSize?: number;
}): Promise<{ items: ExpenseListItem[]; nextCursor: string | null }> {
  const db = getAdminDb();
  const pageSize = options.pageSize ?? 20;
  const collection = db.collection("expenses");

  let query: FirebaseFirestore.Query = collection
    .where("archivedAt", "==", null)
    .orderBy("date", "desc")
    .orderBy("createdAt", "desc");

  if (options.month) {
    const start = `${options.month}-01`;
    const end = `${options.month}-31`;
    query = query.where("date", ">=", start).where("date", "<=", end);
  }

  // Secretary: own records + explicitly assigned records
  if (!options.isSuperAdmin) {
    query = query.where("createdBy", "==", options.uid);
  }

  if (options.cursor) {
    const cursorSnap = await db.collection("expenses").doc(options.cursor).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  const snapshot = await query.limit(pageSize + 1).get();
  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  const items: ExpenseListItem[] = docs.map((doc) => {
    const record = docToExpenseRecord(doc.id, doc.data());
    return {
      id: record.id,
      title: record.title,
      originalAmountMinor: record.originalAmountMinor,
      currency: record.currency,
      baseAmountMinor: record.baseAmountMinor,
      baseCurrency: record.baseCurrency,
      categoryId: record.categoryId,
      date: record.date,
      frequency: record.frequency,
      createdBy: record.createdBy,
      createdAt: record.createdAt,
      archivedAt: record.archivedAt,
      revision: record.revision,
    };
  });

  return {
    items,
    nextCursor: hasMore ? (docs[docs.length - 1]?.id ?? null) : null,
  };
}

/**
 * Returns the full expense record if the requesting user is authorized to view it.
 * Returns null if not found; throws AuthorizationError if found but not authorized.
 */
export async function getExpenseById(
  id: string,
  uid: string,
  isSuperAdmin: boolean,
): Promise<ExpenseRecord | null> {
  if (!id || id.includes("/")) return null;
  const db = getAdminDb();
  const snapshot = await db.collection("expenses").doc(id).get();
  if (!snapshot.exists) return null;

  const record = docToExpenseRecord(snapshot.id, snapshot.data()!);

  // Super Admin can see all; Secretary sees own or assigned
  if (!isSuperAdmin && record.createdBy !== uid && !record.visibleToUserIds.includes(uid)) {
    return null; // Return null rather than leaking existence of the record
  }

  return record;
}

/**
 * Reads an expense inside a transaction for correction/archive operations.
 * Returns null if not found.
 */
export async function getExpenseInTransaction(
  transaction: Transaction,
  id: string,
): Promise<ExpenseRecord | null> {
  if (!id || id.includes("/")) return null;
  const db = getAdminDb();
  const snapshot = await transaction.get(db.collection("expenses").doc(id));
  if (!snapshot.exists) return null;
  return docToExpenseRecord(snapshot.id, snapshot.data()!);
}
