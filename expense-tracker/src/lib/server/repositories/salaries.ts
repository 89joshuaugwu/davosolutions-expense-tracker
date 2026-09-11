import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import type { SalaryLog } from "../../../domain/models";
import { createLedgerPosting } from "../../../domain/ledger";
import type { AuditEvent } from "../audit-model";
import { appendAuditInTransaction } from "../audit";
import { setIdempotencyReceiptInTransaction } from "./idempotency";
import type { DateOnly, ReportingMonth } from "../../../domain/dates";

const SALARIES_COLLECTION = "salaries";

export type SalaryDetail = SalaryLog;

function docToSalaryLog(id: string, data: FirebaseFirestore.DocumentData): SalaryLog {
  const base = {
    id,
    kind: "salary" as const,
    workerName: String(data["workerName"] ?? ""),
    workerRef: (data["workerRef"] as string | null) ?? null,
    period: String(data["period"] ?? "") as unknown as ReportingMonth,
    categoryId: String(data["categoryId"] ?? ""),
    originalAmountMinor: Number(data["originalAmountMinor"]),
    currency: data["currency"],
    baseCurrency: data["baseCurrency"],
    exchangeRateSnapshot: String(data["exchangeRateSnapshot"]),
    rateDate: String(data["rateDate"]),
    baseAmountMinor: Number(data["baseAmountMinor"]),
    notes: String(data["notes"] ?? ""),
    attachments: Array.isArray(data["attachments"]) ? data["attachments"] : [],
    visibleToUserIds: Array.isArray(data["visibleToUserIds"]) ? data["visibleToUserIds"] : [],
    createdBy: String(data["createdBy"] ?? ""),
    createdAt: data["createdAt"]?.toDate?.()?.toISOString() ?? String(data["createdAt"] ?? ""),
    updatedAt: data["updatedAt"]?.toDate?.()?.toISOString() ?? String(data["updatedAt"] ?? ""),
    archivedAt: data["archivedAt"]?.toDate?.()?.toISOString() ?? (data["archivedAt"] as string | null) ?? null,
    archivedBy: (data["archivedBy"] as string | null) ?? null,
    revision: Number(data["revision"] ?? 0),
  };

  if (data["status"] === "paid") {
    return {
      ...base,
      status: "paid",
      paymentDate: String(data["paymentDate"] ?? "") as DateOnly,
    };
  } else {
    return {
      ...base,
      status: "pending",
      paymentDate: (data["paymentDate"] as string | null) as DateOnly | null,
    };
  }
}

export function createSalaryInTransaction(
  transaction: Transaction,
  salary: Omit<SalaryLog, "id" | "createdAt" | "updatedAt" | "revision">,
  auditEvent: AuditEvent,
  idempotencyKey: string,
  idempotencyHash: string,
): string {
  const db = getAdminDb();
  const salaryRef = db.collection(SALARIES_COLLECTION).doc();
  const salaryId = salaryRef.id;

  // Only create a ledger posting if the status is paid
  if (salary.status === "paid") {
    const posting = createLedgerPosting({
      originalAmountMinor: salary.originalAmountMinor,
      currency: salary.currency,
      baseCurrency: salary.baseCurrency,
      exchangeRateSnapshot: salary.exchangeRateSnapshot,
      rateDate: salary.rateDate as DateOnly,
      baseAmountMinor: salary.baseAmountMinor,
      sourceKind: "salary",
      sourceId: salaryId,
      postedOn: salary.paymentDate as DateOnly,
      categoryId: salary.categoryId,
      revenueSourceId: null,
    });

    const ledgerRef = db.collection("ledgerEntries").doc(posting.id);
    transaction.create(ledgerRef, {
      ...posting,
      createdAt: FieldValue.serverTimestamp(),
    });
  }

  const salaryData = {
    ...salary,
    revision: 0,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  transaction.create(salaryRef, salaryData);

  appendAuditInTransaction(transaction, auditEvent);
  setIdempotencyReceiptInTransaction(transaction, idempotencyKey, idempotencyHash, salaryRef.id);

  return salaryId;
}

export async function getSalaryInTransaction(transaction: Transaction, id: string): Promise<SalaryDetail | null> {
  const db = getAdminDb();
  const doc = await transaction.get(db.collection(SALARIES_COLLECTION).doc(id));
  if (!doc.exists) return null;
  return docToSalaryLog(doc.id, doc.data()!);
}

export function correctSalaryInTransaction(
  transaction: Transaction,
  current: SalaryDetail,
  updates: Partial<Omit<SalaryLog, "id" | "kind" | "createdAt" | "updatedAt" | "revision" | "createdBy" | "archivedAt" | "archivedBy">>,
  auditEvent: AuditEvent,
  newPostingInput?: {
    snapshot: import("../../../domain/money").MoneySnapshot;
    postedOn: DateOnly;
    categoryId: string;
  },
): void {
  const db = getAdminDb();
  const salaryRef = db.collection(SALARIES_COLLECTION).doc(current.id);

  if (newPostingInput) {
    // Determine old posting ID
    // We assume there was a posting if it was paid, or if we transition to paid we need a new posting.
    // If it was paid, we archive the old posting.
    if (current.status === "paid") {
      const oldPosting = createLedgerPosting({
        originalAmountMinor: current.originalAmountMinor,
        currency: current.currency,
        baseCurrency: current.baseCurrency,
        exchangeRateSnapshot: current.exchangeRateSnapshot,
        rateDate: current.rateDate as DateOnly,
        baseAmountMinor: current.baseAmountMinor,
        sourceKind: "salary",
        sourceId: current.id,
        postedOn: current.paymentDate,
        categoryId: current.categoryId,
        revenueSourceId: null,
      });
      transaction.update(db.collection("ledgerEntries").doc(oldPosting.id), {
        archivedAt: FieldValue.serverTimestamp(),
      });
    }

    // Only create new posting if status is paid now
    const newStatus = updates.status ?? current.status;
    if (newStatus === "paid") {
      const newPosting = createLedgerPosting({
        ...newPostingInput.snapshot,
        sourceKind: "salary",
        sourceId: current.id,
        postedOn: newPostingInput.postedOn,
        categoryId: newPostingInput.categoryId,
        revenueSourceId: null,
      });
      transaction.set(db.collection("ledgerEntries").doc(newPosting.id), {
        ...newPosting,
        createdAt: FieldValue.serverTimestamp(),
      });
    }
  }

  transaction.update(salaryRef, {
    ...updates,
    revision: current.revision + 1,
    updatedAt: FieldValue.serverTimestamp(),
  });

  appendAuditInTransaction(transaction, auditEvent);
}

export function archiveSalaryInTransaction(
  transaction: Transaction,
  current: SalaryDetail,
  archivedBy: string,
  auditEvent: AuditEvent,
): void {
  const db = getAdminDb();
  const salaryRef = db.collection(SALARIES_COLLECTION).doc(current.id);

  if (current.status === "paid") {
    const oldPosting = createLedgerPosting({
      originalAmountMinor: current.originalAmountMinor,
      currency: current.currency,
      baseCurrency: current.baseCurrency,
      exchangeRateSnapshot: current.exchangeRateSnapshot,
      rateDate: current.rateDate as DateOnly,
      baseAmountMinor: current.baseAmountMinor,
      sourceKind: "salary",
      sourceId: current.id,
      postedOn: current.paymentDate,
      categoryId: current.categoryId,
      revenueSourceId: null,
    });
    transaction.update(db.collection("ledgerEntries").doc(oldPosting.id), {
      archivedAt: FieldValue.serverTimestamp(),
    });
  }

  transaction.update(salaryRef, {
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy,
    revision: current.revision + 1,
    updatedAt: FieldValue.serverTimestamp(),
  });

  appendAuditInTransaction(transaction, auditEvent);
}

export interface GetSalariesFilters {
  period?: string;
  workerName?: string;
  status?: "pending" | "paid";
  limit?: number;
  startAfter?: string;
}

export async function getSalaries(
  allowedUserIds: string[] | null,
  filters: GetSalariesFilters,
): Promise<{ salaries: SalaryDetail[]; nextCursor: string | null }> {
  const db = getAdminDb();
  let query: FirebaseFirestore.Query = db.collection(SALARIES_COLLECTION).where("archivedAt", "==", null);

  if (allowedUserIds !== null) {
    if (allowedUserIds.length === 0) {
      return { salaries: [], nextCursor: null };
    }
    // Simplification for now, exact logic might need array-contains-any or OR queries
    // Assuming we do filtering client-side or use createdBy/visibleToUserIds
    query = query.where("createdBy", "in", allowedUserIds);
  }

  if (filters.period) {
    query = query.where("period", "==", filters.period);
  }
  if (filters.status) {
    query = query.where("status", "==", filters.status);
  }

  const snapshot = await query.get();
  
  let result = snapshot.docs.map((doc) => docToSalaryLog(doc.id, doc.data()));

  // Filter by workerName client-side for simplicity in v1 since Firebase doesn't support substring search easily
  if (filters.workerName) {
    const term = filters.workerName.toLowerCase();
    result = result.filter(r => r.workerName.toLowerCase().includes(term));
  }

  // In-memory sorting (createdAt desc)
  result.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));

  // In-memory pagination
  let startIndex = 0;
  if (filters.startAfter) {
    const cursorIdx = result.findIndex(r => r.id === filters.startAfter);
    if (cursorIdx !== -1) startIndex = cursorIdx + 1;
  }

  const limitNum = filters.limit || 50;
  const paginatedResult = result.slice(startIndex, startIndex + limitNum);
  const hasMore = startIndex + limitNum < result.length;

  const nextCursor = hasMore ? paginatedResult[paginatedResult.length - 1].id : null;

  return { salaries: paginatedResult, nextCursor };
}
