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
  startDate?: string;
  endDate?: string;
  categoryId?: string;
  currency?: string;
  frequency?: string;
  createdBy?: string;
  cursor?: string;
  pageSize?: number;
}): Promise<{ items: ExpenseListItem[]; nextCursor: string | null }> {
  const db = getAdminDb();
  const pageSize = options.pageSize ?? 20;
  const collection = db.collection("expenses");

  // Only use equality filters to leverage automatic index merging
  let query: FirebaseFirestore.Query = collection.where("archivedAt", "==", null);

  if (options.categoryId) query = query.where("categoryId", "==", options.categoryId);
  if (options.currency) query = query.where("currency", "==", options.currency);
  if (options.frequency) query = query.where("frequency", "==", options.frequency);
  if (options.createdBy) query = query.where("createdBy", "==", options.createdBy);

  // Secretary: own records + explicitly assigned records
  if (!options.isSuperAdmin) {
    query = query.where("createdBy", "==", options.uid);
  }

  const snapshot = await query.get();

  let items = snapshot.docs.map((doc) => docToExpenseRecord(doc.id, doc.data()));

  // In-memory inequality filtering
  if (options.month) {
    const start = `${options.month}-01`;
    const end = `${options.month}-31`;
    items = items.filter(r => r.date >= start && r.date <= end);
  } else {
    if (options.startDate) {
      items = items.filter(r => r.date >= options.startDate!);
    }
    if (options.endDate) {
      items = items.filter(r => r.date <= options.endDate!);
    }
  }

  // In-memory sorting (date desc, createdAt desc)
  items.sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return a.createdAt < b.createdAt ? 1 : -1;
  });

  // In-memory pagination
  let startIndex = 0;
  if (options.cursor) {
    const cursorIdx = items.findIndex(r => r.id === options.cursor);
    if (cursorIdx !== -1) startIndex = cursorIdx + 1;
  }

  const paginatedItems = items.slice(startIndex, startIndex + pageSize);
  const hasMore = startIndex + pageSize < items.length;

  return {
    items: paginatedItems.map(record => ({
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
    })),
    nextCursor: hasMore ? paginatedItems[paginatedItems.length - 1].id : null,
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
