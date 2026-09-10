import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import type { TransportLog } from "../../../domain/models";
import { createLedgerPosting } from "../../../domain/ledger";
import type { AuditEvent } from "../audit-model";
import { appendAuditInTransaction } from "../audit";
import { setIdempotencyReceiptInTransaction } from "./idempotency";

export type TransportListItem = Pick<
  TransportLog,
  | "id"
  | "date"
  | "morningAmountMinor"
  | "eveningAmountMinor"
  | "extraAmountMinor"
  | "originalAmountMinor"
  | "currency"
  | "baseAmountMinor"
  | "baseCurrency"
  | "categoryId"
  | "createdBy"
  | "createdAt"
  | "archivedAt"
  | "revision"
>;

function docToTransport(id: string, data: FirebaseFirestore.DocumentData): TransportLog {
  return {
    id,
    kind: "transport",
    date: String(data["date"] ?? ""),
    categoryId: String(data["categoryId"] ?? ""),
    morningAmountMinor: Number(data["morningAmountMinor"] ?? 0),
    eveningAmountMinor: Number(data["eveningAmountMinor"] ?? 0),
    extraAmountMinor: Number(data["extraAmountMinor"] ?? 0),
    extraReason: String(data["extraReason"] ?? ""),
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

export function createTransportInTransaction(
  t: Transaction,
  data: Omit<TransportLog, "id" | "createdAt" | "updatedAt" | "revision">,
  userRole: "super_admin" | "secretary",
  idempotencyKey: string,
  receiptReturnPayload: unknown
): string {
  const db = getAdminDb();
  const transportRef = db.collection("transportLogs").doc();
  const transportId = transportRef.id;

  const now = FieldValue.serverTimestamp();
  
  // Save transport log
  t.set(transportRef, {
    ...data,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  });

  // Create unified ledger posting for the total amount
  const posting = createLedgerPosting({
    sourceId: transportId,
    sourceKind: "transport",
    postedOn: data.date,
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

  // Create audit event
  const auditEvent: AuditEvent = {
    action: "record.create",
    actor: { uid: data.createdBy, role: userRole },
    target: { collection: "transportLogs", id: transportId },
    reason: "New transport log",
    after: data,
  };
  appendAuditInTransaction(t, auditEvent);

  // Set idempotency receipt
  setIdempotencyReceiptInTransaction(t, `${data.createdBy}_createTransport_${idempotencyKey}`, "dummy-hash", transportId);

  return transportId;
}

export async function getTransportList({
  month,
  userId,
  limitCount,
  startAfterId,
}: {
  month?: string; // YYYY-MM
  userId?: string;
  limitCount: number;
  startAfterId?: string;
}) {
  const db = getAdminDb();
  let q = db.collection("transportLogs").orderBy("date", "desc").orderBy("__name__", "desc");

  if (month) {
    q = q.where("date", ">=", `${month}-01`).where("date", "<=", `${month}-31`);
  }
  if (userId) {
    // Secretary role or individual users see their own OR explicitly assigned entries.
    // Ensure "visibleToUserIds" array-contains indexing works here.
    q = q.where("visibleToUserIds", "array-contains", userId);
  }
  
  if (startAfterId) {
    const snap = await db.collection("transportLogs").doc(startAfterId).get();
    if (snap.exists) {
      q = q.startAfter(snap);
    }
  }

  q = q.limit(limitCount);
  const snapshot = await q.get();
  return snapshot.docs.map((d) => {
    const full = docToTransport(d.id, d.data());
    return {
      id: full.id,
      date: full.date,
      morningAmountMinor: full.morningAmountMinor,
      eveningAmountMinor: full.eveningAmountMinor,
      extraAmountMinor: full.extraAmountMinor,
      originalAmountMinor: full.originalAmountMinor,
      currency: full.currency,
      baseAmountMinor: full.baseAmountMinor,
      baseCurrency: full.baseCurrency,
      categoryId: full.categoryId,
      createdBy: full.createdBy,
      createdAt: full.createdAt,
      archivedAt: full.archivedAt,
      revision: full.revision,
    } as TransportListItem;
  });
}

export async function getTransportLog(id: string): Promise<TransportLog | null> {
  const db = getAdminDb();
  const snap = await db.collection("transportLogs").doc(id).get();
  if (!snap.exists) return null;
  return docToTransport(snap.id, snap.data()!);
}

export function updateTransportInTransaction(
  t: Transaction,
  transportId: string,
  existingTransport: TransportLog,
  update: { action: "archive"; reason: string; actorId: string; actorRole: "super_admin" | "secretary" }
) {
  const db = getAdminDb();
  const transportRef = db.collection("transportLogs").doc(transportId);

  const now = FieldValue.serverTimestamp();
  const newRevision = existingTransport.revision + 1;

  if (update.action === "archive") {
    t.update(transportRef, {
      archivedAt: now,
      archivedBy: update.actorId,
      updatedAt: now,
      revision: newRevision,
    });

    const posting = createLedgerPosting({
      sourceId: transportId,
      sourceKind: "transport",
      postedOn: existingTransport.date,
      categoryId: existingTransport.categoryId,
      revenueSourceId: null,
      originalAmountMinor: existingTransport.originalAmountMinor,
      currency: existingTransport.currency,
      baseAmountMinor: existingTransport.baseAmountMinor,
      baseCurrency: existingTransport.baseCurrency,
      exchangeRateSnapshot: existingTransport.exchangeRateSnapshot,
      rateDate: existingTransport.rateDate,
      archivedAt: new Date().toISOString(), // Simulating server time conceptually for ID purposes
    });

    const postingRef = db.collection("ledgerEntries").doc(posting.id);
    t.update(postingRef, { archivedAt: now });

    const auditEvent: AuditEvent = {
      action: "record.archive",
      actor: { uid: update.actorId, role: update.actorRole },
      target: { collection: "transportLogs", id: transportId },
      reason: update.reason,
      before: existingTransport as unknown as Record<string, unknown>,
      after: { ...existingTransport, archivedAt: "server-timestamp" } as unknown as Record<string, unknown>,
    };
    appendAuditInTransaction(t, auditEvent);
  }
}
