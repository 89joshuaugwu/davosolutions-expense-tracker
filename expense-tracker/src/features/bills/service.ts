import "server-only";

import { getAdminDb } from "@/lib/firebase/admin";
import type { UserProfile } from "@/lib/auth/model";
import { checkIdempotency } from "@/lib/server/repositories/idempotency";
import { createBillInTransaction, getBills, getBill, updateBillInTransaction, createBillPaymentInTransaction, getBillPayments, type BillListItem } from "@/lib/server/repositories/bills";
import { createBillSchema, payBillSchema, updateBillStatusSchema, parseBillAmount, type CreateBillDto, type PayBillDto, type UpdateBillStatusDto } from "./schema";
import { getEffectiveRate } from "@/lib/server/repositories/exchange-rates";
import { getCompanySettings } from "@/lib/server/repositories/settings";
import { canCreateOperationalRecord, canViewOperationalKind, isSuperAdmin } from "@/lib/auth/permissions";

/** Advances a date string by 1 month, preserving end-of-month anchoring if the original day was 31 */
function advanceMonth(dateStr: string): string {
  const [year, month, day] = dateStr.split("-").map(Number);
  let nextMonth = month + 1;
  let nextYear = year;
  if (nextMonth > 12) {
    nextMonth = 1;
    nextYear++;
  }
  
  // Calculate max days in next month
  const leap = nextYear % 4 === 0 && (nextYear % 100 !== 0 || nextYear % 400 === 0);
  const daysInMonth = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDays = daysInMonth[nextMonth - 1];
  
  let nextDay = day;
  if (day === 31 || day > maxDays) {
    nextDay = maxDays;
  }
  
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
}

export class BillsService {
  static async createBill(user: UserProfile, input: CreateBillDto): Promise<{ id: string }> {
    if (!canCreateOperationalRecord(user)) throw new Error("Forbidden");

    const data = createBillSchema.parse(input);
    const amountMinor = parseBillAmount(data.expectedAmount, data.currency);

    const settings = await getCompanySettings();
    if (!settings) throw new Error("System settings missing");
    if (data.currency !== settings.baseCurrency && !settings.enabledCurrencies.includes(data.currency)) {
      throw new Error(`Currency ${data.currency} is not enabled`);
    }

    const { existing, conflict } = await checkIdempotency(`${user.uid}_createBill_${data.idempotencyKey}`, "dummy-hash");
    if (conflict) throw new Error("Idempotency conflict");
    if (existing) return { id: existing };

    const db = getAdminDb();
    return db.runTransaction(async (t) => {
      const catRef = db.collection("categories").doc(data.categoryId);
      const catSnap = await t.get(catRef);
      if (!catSnap.exists || catSnap.data()?.isActive !== true) {
        throw new Error("Category not found or inactive");
      }

      const billId = createBillInTransaction(
        t,
        {
          kind: "bill",
          name: data.name,
          provider: data.provider,
          categoryId: data.categoryId,
          amountMinor,
          currency: data.currency,
          frequency: data.frequency,
          nextDueDate: data.nextDueDate,
          reminderDays: data.reminderDays,
          responsibleUserId: user.uid, // Creator is default responsible user for v1
          status: "active",
          notes: data.notes || "",
          attachments: [],
          visibleToUserIds: [user.uid],
          createdBy: user.uid,
          archivedAt: null,
          archivedBy: null,
        },
        user.role,
        data.idempotencyKey
      );

      return { id: billId };
    });
  }

  static async getBills(user: UserProfile, status?: "active" | "paused" | "completed"): Promise<BillListItem[]> {
    if (!canViewOperationalKind(user, "bill")) return [];

    const userIdFilter = isSuperAdmin(user) ? undefined : user.uid;
    return getBills({ status, userId: userIdFilter });
  }

  static async getBillDetail(user: UserProfile, id: string) {
    if (!canViewOperationalKind(user, "bill")) return null;

    const bill = await getBill(id);
    if (!bill) return null;

    if (!isSuperAdmin(user) && !bill.visibleToUserIds.includes(user.uid)) {
      return null;
    }

    const payments = await getBillPayments(id);

    return { bill, payments };
  }

  static async updateBillStatus(user: UserProfile, id: string, input: UpdateBillStatusDto) {
    const data = updateBillStatusSchema.parse(input);
    const db = getAdminDb();

    await db.runTransaction(async (t) => {
      const billRef = db.collection("bills").doc(id);
      const snap = await t.get(billRef);
      if (!snap.exists) throw new Error("Not found");

      const existing = snap.data() as unknown as import("@/domain/models").Bill;
      if (!isSuperAdmin(user) && !existing.visibleToUserIds.includes(user.uid)) {
        throw new Error("Forbidden");
      }
      
      if (existing.revision !== data.expectedRevision) {
        throw new Error("Conflict: record has been updated by someone else.");
      }

      updateBillInTransaction(t, id, existing, { status: data.status }, "user.update", data.reason, user.uid, user.role);
    });
  }

  static async payBill(user: UserProfile, id: string, input: PayBillDto): Promise<{ paymentId: string }> {
    if (!canCreateOperationalRecord(user)) throw new Error("Forbidden");

    const data = payBillSchema.parse(input);
    const db = getAdminDb();
    
    const settings = await getCompanySettings();
    if (!settings) throw new Error("System settings missing");

    const { existing, conflict } = await checkIdempotency(`${user.uid}_payBill_${data.idempotencyKey}`, "dummy-hash");
    if (conflict) throw new Error("Idempotency conflict");
    if (existing) return { paymentId: existing };

    return db.runTransaction(async (t) => {
      const billRef = db.collection("bills").doc(id);
      const snap = await t.get(billRef);
      if (!snap.exists) throw new Error("Bill not found");

      const bill = snap.data() as unknown as import("@/domain/models").Bill;
      if (!isSuperAdmin(user) && !bill.visibleToUserIds.includes(user.uid)) {
        throw new Error("Forbidden");
      }
      
      if (bill.status !== "active") {
        throw new Error("Cannot pay an inactive bill");
      }

      // Check if this exact occurrence was already paid
      // Since payment ID is deterministic, we can check it
      const paymentIdToCheck = `${id}__${data.occurrenceDate}`;
      const existingPaymentSnap = await t.get(db.collection("billPayments").doc(paymentIdToCheck));
      if (existingPaymentSnap.exists) {
        throw new Error(`Occurrence ${data.occurrenceDate} is already paid.`);
      }

      const amountMinor = parseBillAmount(data.actualAmount, bill.currency);
      let baseAmountMinor = amountMinor;
      let rateSnapshot = "1.000000";
      let rateDate = data.paymentDate;

      if (bill.currency !== settings.baseCurrency) {
        const fx = await getEffectiveRate(bill.currency, settings.baseCurrency, data.paymentDate);
        if (!fx) throw new Error(`No exchange rate found for ${bill.currency} on ${data.paymentDate}`);
        rateSnapshot = fx.rate;
        rateDate = fx.effectiveFrom;
        const rateNum = parseFloat(fx.rate);
        baseAmountMinor = Math.round(amountMinor * rateNum);
      }

      // Advance due date if they are paying the current one or a future one (for simplicity in v1)
      let newNextDueDate = null;
      if (data.occurrenceDate >= bill.nextDueDate) {
        if (bill.frequency === "monthly") {
          newNextDueDate = advanceMonth(data.occurrenceDate);
        } else {
          // Future: support yearly/daily advances. For now, monthly is the main use case.
          // For one_time, change status to completed.
        }
      }

      // If it's a one_time bill and they paid it, we might complete it
      if (bill.frequency === "one_time" && data.occurrenceDate === bill.nextDueDate) {
        updateBillInTransaction(t, id, bill, { status: "completed" }, "user.update", "Paid one-time bill", user.uid, user.role);
      }

      const paymentId = createBillPaymentInTransaction(
        t,
        {
          billId: id,
          occurrenceDate: data.occurrenceDate,
          paymentDate: data.paymentDate,
          categoryId: bill.categoryId,
          originalAmountMinor: amountMinor,
          currency: bill.currency,
          baseCurrency: settings.baseCurrency,
          exchangeRateSnapshot: rateSnapshot,
          rateDate: rateDate,
          baseAmountMinor: baseAmountMinor,
          notes: data.notes || "",
          attachments: [], // Not fully implemented Cloudinary sync
          visibleToUserIds: bill.visibleToUserIds,
          createdBy: user.uid,
          archivedAt: null,
          archivedBy: null,
        },
        bill,
        newNextDueDate,
        user.role,
        data.idempotencyKey
      );

      return { paymentId };
    });
  }
}
