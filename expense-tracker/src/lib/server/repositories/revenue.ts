import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import type { RevenueRecord } from "../../../domain/models";
import { createLedgerPosting } from "../../../domain/ledger";
import type { AuditEvent } from "../audit-model";
import { appendAuditInTransaction } from "../audit";
import { setIdempotencyReceiptInTransaction } from "./idempotency";

export type RevenueListItem = Pick<
  RevenueRecord,
  | "id"
  | "description"
  | "originalAmountMinor"
  | "currency"
  | "baseAmountMinor"
  | "baseCurrency"
  | "sourceId"
  | "date"
  | "createdBy"
  | "createdAt"
  | "archivedAt"
  | "revision"
>;

export type RevenueDetail = RevenueRecord;

function docToRevenueRecord(id: string, data: FirebaseFirestore.DocumentData): RevenueRecord {
  return {
    id,
    description: String(data["description"] ?? ""),
    originalAmountMinor: Number(data["originalAmountMinor"]),
    currency: data["currency"],
    baseCurrency: data["baseCurrency"],
    exchangeRateSnapshot: String(data["exchangeRateSnapshot"]),
    rateDate: String(data["rateDate"]),
    baseAmountMinor: Number(data["baseAmountMinor"]),
    sourceId: String(data["sourceId"] ?? ""),
    date: String(data["date"] ?? ""),
    notes: String(data["notes"] ?? ""),
    attachments: Array.isArray(data["attachments"]) ? data["attachments"] : [],
    createdBy: String(data["createdBy"] ?? ""),
    createdAt: data["createdAt"]?.toDate?.()?.toISOString() ?? String(data["createdAt"] ?? ""),
    updatedAt: data["updatedAt"]?.toDate?.()?.toISOString() ?? String(data["updatedAt"] ?? ""),
    archivedAt: data["archivedAt"]?.toDate?.()?.toISOString() ?? (data["archivedAt"] as string | null) ?? null,
    archivedBy: (data["archivedBy"] as string | null) ?? null,
    revision: Number(data["revision"] ?? 0),
  };
}

export function createRevenueInTransaction(
  transaction: Transaction,
  revenue: Omit<RevenueRecord, "id" | "createdAt" | "updatedAt" | "revision">,
  postingInput: {
    snapshot: import("../../../domain/money").MoneySnapshot;
    postedOn: import("../../../domain/dates").DateOnly;
    sourceId: string;
  },
  auditEvent: AuditEvent,
  idempotencyKey: string,
  idempotencyHash: string,
): string {
  const db = getAdminDb();
  const revenueRef = db.collection("revenue").doc();
  const revenueId = revenueRef.id;

  const posting = createLedgerPosting({
    ...postingInput.snapshot,
    sourceKind: "revenue",
    sourceId: revenueId,
    postedOn: postingInput.postedOn,
    categoryId: null,
    revenueSourceId: postingInput.sourceId,
  });

  const ledgerRef = db.collection("ledgerEntries").doc(posting.id);

  const revenueData = {
    ...revenue,
    revision: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  transaction.create(revenueRef, revenueData);
  transaction.create(ledgerRef, {
    ...posting,
    createdAt: FieldValue.serverTimestamp(),
  });

  appendAuditInTransaction(transaction, auditEvent);
  setIdempotencyReceiptInTransaction(transaction, idempotencyKey, idempotencyHash, revenueRef.id);

  return revenueRef.id;
}

export function correctRevenueInTransaction(
  transaction: Transaction,
  revenueId: string,
  patch: Partial<Pick<RevenueRecord, "description" | "notes" | "sourceId" | "date">>,
  expectedRevision: number,
  updatedBy: string,
  auditEvent: AuditEvent,
): void {
  const db = getAdminDb();
  const ref = db.collection("revenue").doc(revenueId);
  transaction.update(ref, {
    ...patch,
    revision: expectedRevision + 1,
    updatedAt: FieldValue.serverTimestamp(),
  });
  appendAuditInTransaction(transaction, auditEvent);
}

export function archiveRevenueInTransaction(
  transaction: Transaction,
  revenueId: string,
  expectedRevision: number,
  archivedBy: string,
  auditEvent: AuditEvent,
): void {
  const db = getAdminDb();
  const revenueRef = db.collection("revenue").doc(revenueId);
  const ledgerRef = db.collection("ledgerEntries").doc(`revenue:${revenueId}`);

  const now = FieldValue.serverTimestamp();
  transaction.update(revenueRef, {
    archivedAt: now,
    archivedBy,
    revision: expectedRevision + 1,
    updatedAt: now,
  });
  transaction.update(ledgerRef, { archivedAt: now });
  appendAuditInTransaction(transaction, auditEvent);
}

export async function listRevenue(options: {
  month?: string;
  startDate?: string;
  endDate?: string;
  sourceId?: string;
  currency?: string;
  createdBy?: string;
  cursor?: string;
  pageSize?: number;
}): Promise<{ items: RevenueListItem[]; nextCursor: string | null }> {
  const db = getAdminDb();
  const pageSize = options.pageSize ?? 20;
  const collection = db.collection("revenue");

  let query: FirebaseFirestore.Query = collection
    .where("archivedAt", "==", null)
    .orderBy("date", "desc")
    .orderBy("createdAt", "desc");

  if (options.month) {
    const start = `${options.month}-01`;
    const end = `${options.month}-31`;
    query = query.where("date", ">=", start).where("date", "<=", end);
  } else {
    if (options.startDate) {
      query = query.where("date", ">=", options.startDate);
    }
    if (options.endDate) {
      query = query.where("date", "<=", options.endDate);
    }
  }

  if (options.sourceId) query = query.where("sourceId", "==", options.sourceId);
  if (options.currency) query = query.where("currency", "==", options.currency);
  if (options.createdBy) query = query.where("createdBy", "==", options.createdBy);

  if (options.cursor) {
    const cursorSnap = await db.collection("revenue").doc(options.cursor).get();
    if (cursorSnap.exists) query = query.startAfter(cursorSnap);
  }

  const snapshot = await query.limit(pageSize + 1).get();
  const hasMore = snapshot.docs.length > pageSize;
  const docs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  const items: RevenueListItem[] = docs.map((doc) => {
    const record = docToRevenueRecord(doc.id, doc.data());
    return {
      id: record.id,
      description: record.description,
      originalAmountMinor: record.originalAmountMinor,
      currency: record.currency,
      baseAmountMinor: record.baseAmountMinor,
      baseCurrency: record.baseCurrency,
      sourceId: record.sourceId,
      date: record.date,
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

export async function getRevenueById(
  id: string,
): Promise<RevenueRecord | null> {
  if (!id || id.includes("/")) return null;
  const db = getAdminDb();
  const snapshot = await db.collection("revenue").doc(id).get();
  if (!snapshot.exists) return null;

  return docToRevenueRecord(snapshot.id, snapshot.data()!);
}

export async function getRevenueInTransaction(
  transaction: Transaction,
  id: string,
): Promise<RevenueRecord | null> {
  if (!id || id.includes("/")) return null;
  const db = getAdminDb();
  const snapshot = await transaction.get(db.collection("revenue").doc(id));
  if (!snapshot.exists) return null;
  return docToRevenueRecord(snapshot.id, snapshot.data()!);
}
