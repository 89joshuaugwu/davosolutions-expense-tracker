import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import type { Bill, BillPayment } from "../../../domain/models";
import { createLedgerPosting, billPaymentId } from "../../../domain/ledger";
import type { AuditEvent } from "../audit-model";
import { appendAuditInTransaction } from "../audit";
import { setIdempotencyReceiptInTransaction } from "./idempotency";

export type BillListItem = Pick<
  Bill,
  | "id"
  | "name"
  | "provider"
  | "amountMinor"
  | "currency"
  | "frequency"
  | "nextDueDate"
  | "status"
  | "categoryId"
  | "createdBy"
  | "createdAt"
>;

function docToBill(id: string, data: FirebaseFirestore.DocumentData): Bill {
  return {
    id,
    kind: "bill",
    name: String(data["name"] ?? ""),
    provider: String(data["provider"] ?? ""),
    categoryId: String(data["categoryId"] ?? ""),
    amountMinor: Number(data["amountMinor"]),
    currency: data["currency"],
    frequency: data["frequency"],
    nextDueDate: data["nextDueDate"],
    reminderDays: Array.isArray(data["reminderDays"]) ? data["reminderDays"] : [],
    responsibleUserId: (data["responsibleUserId"] as string | null) ?? null,
    status: data["status"],
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
}

function docToBillPayment(id: string, data: FirebaseFirestore.DocumentData): BillPayment {
  return {
    id,
    billId: String(data["billId"] ?? ""),
    occurrenceDate: String(data["occurrenceDate"] ?? ""),
    paymentDate: String(data["paymentDate"] ?? ""),
    categoryId: String(data["categoryId"] ?? ""),
    ledgerEntryId: String(data["ledgerEntryId"] ?? ""),
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
}

export function createBillInTransaction(
  t: Transaction,
  data: Omit<Bill, "id" | "createdAt" | "updatedAt" | "revision">,
  userRole: "super_admin" | "secretary",
  idempotencyKey: string
): string {
  const db = getAdminDb();
  const billRef = db.collection("bills").doc();
  const billId = billRef.id;

  const now = FieldValue.serverTimestamp();
  
  t.set(billRef, {
    ...data,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  });

  const auditEvent: AuditEvent = {
    action: "record.create",
    actor: { uid: data.createdBy, role: userRole },
    target: { collection: "bills", id: billId },
    reason: "New bill created",
    after: data as unknown as Record<string, unknown>,
  };
  appendAuditInTransaction(t, auditEvent);
  setIdempotencyReceiptInTransaction(t, `${data.createdBy}_createBill_${idempotencyKey}`, "dummy-hash", billId);

  return billId;
}

export async function getBills({
  status,
  userId,
}: {
  status?: "active" | "paused" | "completed";
  userId?: string;
}) {
  const db = getAdminDb();
  // Fetch all bills and filter/sort in memory to avoid Firestore composite index errors.
  const snapshot = await db.collection("bills").get();
  
  let bills = snapshot.docs.map((d) => {
    const full = docToBill(d.id, d.data());
    return {
      id: full.id,
      name: full.name,
      provider: full.provider,
      amountMinor: full.amountMinor,
      currency: full.currency,
      frequency: full.frequency,
      nextDueDate: full.nextDueDate,
      status: full.status,
      categoryId: full.categoryId,
      createdBy: full.createdBy,
      createdAt: full.createdAt,
      visibleToUserIds: full.visibleToUserIds, // include temporarily for filtering
    };
  });

  if (status) {
    bills = bills.filter(b => b.status === status);
  }
  
  if (userId) {
    bills = bills.filter(b => b.visibleToUserIds.includes(userId));
  }

  // Sort by nextDueDate ascending
  bills.sort((a, b) => {
    if (a.nextDueDate < b.nextDueDate) return -1;
    if (a.nextDueDate > b.nextDueDate) return 1;
    return 0;
  });

  return bills.map(b => {
    const { visibleToUserIds: _visibleToUserIds, ...rest } = b;
    return rest as BillListItem;
  });
}

export async function getBill(id: string): Promise<Bill | null> {
  const db = getAdminDb();
  const snap = await db.collection("bills").doc(id).get();
  if (!snap.exists) return null;
  return docToBill(snap.id, snap.data()!);
}

export function updateBillInTransaction(
  t: Transaction,
  billId: string,
  existingBill: Bill,
  update: Partial<Bill>,
  action: AuditEvent["action"],
  reason: string,
  actorId: string,
  actorRole: "super_admin" | "secretary"
) {
  const db = getAdminDb();
  const ref = db.collection("bills").doc(billId);

  const now = FieldValue.serverTimestamp();
  const newRevision = existingBill.revision + 1;

  t.update(ref, {
    ...update,
    updatedAt: now,
    revision: newRevision,
  });

  const auditEvent: AuditEvent = {
    action,
    actor: { uid: actorId, role: actorRole },
    target: { collection: "bills", id: billId },
    reason,
    before: existingBill as unknown as Record<string, unknown>,
    after: { ...existingBill, ...update, revision: newRevision } as unknown as Record<string, unknown>,
  };
  appendAuditInTransaction(t, auditEvent);
}

export function createBillPaymentInTransaction(
  t: Transaction,
  data: Omit<BillPayment, "id" | "createdAt" | "updatedAt" | "revision" | "ledgerEntryId">,
  bill: Bill,
  newNextDueDate: string | null,
  userRole: "super_admin" | "secretary",
  idempotencyKey: string
): string {
  const db = getAdminDb();
  // Payment ID should be exactly billId__occurrenceDate for idempotency guarantees on occurrences
  const paymentId = billPaymentId(data.billId, data.occurrenceDate);
  const paymentRef = db.collection("billPayments").doc(paymentId);
  
  // Ledger ID is the same as payment ID since we want them to tie uniquely
  const ledgerId = paymentId;

  const now = FieldValue.serverTimestamp();
  
  const paymentRecord = {
    ...data,
    ledgerEntryId: ledgerId,
  };

  t.create(paymentRef, {
    ...paymentRecord,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  });

  const posting = createLedgerPosting({
    sourceId: paymentId,
    sourceKind: "bill_payment",
    postedOn: data.paymentDate,
    categoryId: data.categoryId,
    revenueSourceId: null,
    originalAmountMinor: data.originalAmountMinor,
    currency: data.currency,
    baseAmountMinor: data.baseAmountMinor,
    baseCurrency: data.baseCurrency,
    exchangeRateSnapshot: data.exchangeRateSnapshot,
    rateDate: data.rateDate,
  });

  const postingRef = db.collection("ledgerEntries").doc(posting.id);
  t.set(postingRef, {
    ...posting,
    createdAt: now,
  });

  // Update bill if needed
  if (newNextDueDate) {
    const billRef = db.collection("bills").doc(bill.id);
    t.update(billRef, {
      nextDueDate: newNextDueDate,
      updatedAt: now,
      revision: bill.revision + 1,
    });
  }

  const auditEvent: AuditEvent = {
    action: "bill.payment",
    actor: { uid: data.createdBy, role: userRole },
    target: { collection: "bills", id: data.billId },
    reason: `Paid occurrence ${data.occurrenceDate}`,
    after: paymentRecord as unknown as Record<string, unknown>,
  };
  appendAuditInTransaction(t, auditEvent);

  setIdempotencyReceiptInTransaction(t, `${data.createdBy}_payBill_${idempotencyKey}`, "dummy-hash", paymentId);

  return paymentId;
}

export async function getBillPayments(billId: string): Promise<BillPayment[]> {
  const db = getAdminDb();
  const snap = await db.collection("billPayments")
    .where("billId", "==", billId)
    .orderBy("occurrenceDate", "desc")
    .get();
  
  return snap.docs.map(d => docToBillPayment(d.id, d.data()));
}
