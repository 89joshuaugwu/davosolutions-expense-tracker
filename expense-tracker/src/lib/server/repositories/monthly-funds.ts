import "server-only";

import { FieldValue, type Transaction } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import type { MonthlyFund } from "../../../domain/models";
import type { LedgerPosting } from "../../../domain/ledger";
import type { AuditEvent } from "../audit-model";
import { appendAuditInTransaction } from "../audit";
import { setIdempotencyReceiptInTransaction } from "./idempotency";

export function docToMonthlyFund(id: string, data: FirebaseFirestore.DocumentData): MonthlyFund {
  return {
    id,
    month: data["month"],
    source: String(data["source"] ?? ""),
    originalAmountMinor: Number(data["originalAmountMinor"]),
    currency: data["currency"],
    baseCurrency: data["baseCurrency"],
    exchangeRateSnapshot: String(data["exchangeRateSnapshot"]),
    rateDate: String(data["rateDate"]),
    baseAmountMinor: Number(data["baseAmountMinor"]),
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

export function createMonthlyFundInTransaction(
  t: Transaction,
  data: Omit<MonthlyFund, "id" | "createdAt" | "updatedAt" | "revision">,
  userRole: "super_admin" | "secretary",
  idempotencyKey: string
): string {
  const db = getAdminDb();
  const fundId = data.month;
  const fundRef = db.collection("monthlyFunds").doc(fundId);

  const now = FieldValue.serverTimestamp();
  
  t.create(fundRef, {
    ...data,
    createdAt: now,
    updatedAt: now,
    revision: 1,
  });

  const auditEvent: AuditEvent = {
    action: "record.create",
    actor: { uid: data.createdBy, role: userRole },
    target: { collection: "monthlyFunds", id: fundId },
    reason: `Allocated monthly fund for ${data.month}`,
    after: data as any,
  };
  appendAuditInTransaction(t, auditEvent);
  setIdempotencyReceiptInTransaction(t, `${data.createdBy}_createFund_${idempotencyKey}`, "dummy-hash", fundId);

  return fundId;
}

export async function getMonthlyFunds(): Promise<MonthlyFund[]> {
  const db = getAdminDb();
  const snap = await db.collection("monthlyFunds").orderBy("month", "desc").get();
  return snap.docs.map(d => docToMonthlyFund(d.id, d.data()));
}

export async function getMonthlyFund(month: string): Promise<MonthlyFund | null> {
  const db = getAdminDb();
  const snap = await db.collection("monthlyFunds").doc(month).get();
  if (!snap.exists) return null;
  return docToMonthlyFund(snap.id, snap.data()!);
}

export async function getLedgerEntriesForMonth(month: string): Promise<LedgerPosting[]> {
  const db = getAdminDb();
  // Using lexicographical string comparison for date strings (YYYY-MM-DD)
  const snap = await db.collection("ledgerEntries")
    .where("postedOn", ">=", `${month}-01`)
    .where("postedOn", "<=", `${month}-31`)
    .get();

  return snap.docs.map(d => {
    const data = d.data();
    return {
      id: d.id,
      sourceKind: data["sourceKind"],
      sourceId: data["sourceId"],
      direction: data["direction"],
      postedOn: data["postedOn"],
      categoryId: data["categoryId"] ?? null,
      revenueSourceId: data["revenueSourceId"] ?? null,
      archivedAt: data["archivedAt"] ?? null,
      originalAmountMinor: Number(data["originalAmountMinor"]),
      currency: data["currency"],
      baseCurrency: data["baseCurrency"],
      exchangeRateSnapshot: String(data["exchangeRateSnapshot"]),
      rateDate: String(data["rateDate"]),
      baseAmountMinor: Number(data["baseAmountMinor"]),
    } as LedgerPosting;
  });
}
