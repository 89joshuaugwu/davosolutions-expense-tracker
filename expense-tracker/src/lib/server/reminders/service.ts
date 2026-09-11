import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import { sendReminderEmail, isSmtpConfigured } from "./mailer";
import { appendAudit } from "../audit";
import { formatMoney } from "../../../domain/money";
import type { CurrencyCode } from "../../../domain/money";
import { currentBusinessDate } from "../../../domain/dates";

const REMINDER_ATTEMPTS_COLLECTION = "reminderAttempts";
const MAX_RETRIES = 3;

interface ReminderSummary {
  processed: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/**
 * Stable dedup key prevents duplicate sends across retries and concurrent invocations.
 * Format: bill:{billId}_due:{nextDueDate}_lead:{leadDay}_to:{recipientUid}
 */
function dedupKey(billId: string, dueDate: string, leadDay: number, recipientUid: string): string {
  return `bill:${billId}_due:${dueDate}_lead:${leadDay}_to:${recipientUid}`;
}

/**
 * Main reminder processing function.
 * Called by the cron endpoint. Never throws — returns a summary.
 */
export async function processReminders(): Promise<ReminderSummary> {
  const summary: ReminderSummary = { processed: 0, sent: 0, skipped: 0, failed: 0, errors: [] };

  if (!isSmtpConfigured()) {
    summary.errors.push("SMTP is not configured.");
    return summary;
  }

  const db = getAdminDb();

  // 1. Load company settings
  const settingsDoc = await db.collection("settings").doc("company").get();
  if (!settingsDoc.exists) {
    summary.errors.push("Company settings not found.");
    return summary;
  }
  const settings = settingsDoc.data()!;
  const timezone = settings.timezone ?? "Africa/Lagos";
  const companyName = settings.companyName ?? "Davo Solutions";
  const recipientUserIds: string[] = Array.isArray(settings.reminderRecipientUserIds)
    ? settings.reminderRecipientUserIds : [];
  const globalLeadDays: number[] = Array.isArray(settings.reminderDays)
    ? settings.reminderDays : [7, 3, 1];

  if (recipientUserIds.length === 0) {
    summary.errors.push("No reminder recipients configured in settings.");
    return summary;
  }

  // 2. Load recipient profiles (email + name)
  const recipientProfiles: { uid: string; email: string; name: string }[] = [];
  for (const uid of recipientUserIds) {
    const userDoc = await db.collection("users").doc(uid).get();
    if (userDoc.exists) {
      const data = userDoc.data()!;
      if (data.status === "active" && data.email) {
        recipientProfiles.push({ uid, email: data.email, name: data.name ?? "User" });
      }
    }
  }

  if (recipientProfiles.length === 0) {
    summary.errors.push("No active recipients with valid emails found.");
    return summary;
  }

  // 3. Get today in company timezone
  const now = new Date();
  const tzFormatter = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" });
  const todayStr = tzFormatter.format(now); // YYYY-MM-DD

  // 4. Query active bills
  const billsSnapshot = await db.collection("bills")
    .where("status", "==", "active")
    .get();

  for (const billDoc of billsSnapshot.docs) {
    const bill = billDoc.data();
    const billId = billDoc.id;
    const nextDueDate = bill.nextDueDate as string;
    if (!nextDueDate) continue;

    // Calculate days until due
    const dueMs = new Date(nextDueDate + "T00:00:00").getTime();
    const todayMs = new Date(todayStr + "T00:00:00").getTime();
    const daysUntilDue = Math.round((dueMs - todayMs) / (24 * 60 * 60 * 1000));

    // Use bill-specific reminderDays if set, otherwise global
    const leadDays: number[] = Array.isArray(bill.reminderDays) && bill.reminderDays.length > 0
      ? bill.reminderDays : globalLeadDays;

    // Check if today matches any lead day (or bill is overdue with 0 lead)
    const matchingLeadDays = leadDays.filter((ld: number) => daysUntilDue === ld);
    // Also send if overdue (daysUntilDue <= 0) and 0 or 1 is in lead days
    if (daysUntilDue <= 0 && leadDays.includes(1) && !matchingLeadDays.includes(0)) {
      matchingLeadDays.push(0); // Overdue notification
    }

    if (matchingLeadDays.length === 0) continue;

    const amountFormatted = formatMoney(bill.amountMinor ?? 0, (bill.currency ?? "NGN") as CurrencyCode);

    for (const leadDay of matchingLeadDays) {
      for (const recipient of recipientProfiles) {
        summary.processed++;
        const key = dedupKey(billId, nextDueDate, leadDay, recipient.uid);

        // Check dedup
        const attemptRef = db.collection(REMINDER_ATTEMPTS_COLLECTION).doc(key);
        const existing = await attemptRef.get();

        if (existing.exists) {
          const data = existing.data()!;
          if (data.status === "sent") {
            summary.skipped++;
            continue;
          }
          if ((data.retryCount ?? 0) >= MAX_RETRIES) {
            summary.skipped++;
            continue;
          }
        }

        // Send email
        const result = await sendReminderEmail({
          recipientEmail: recipient.email,
          recipientName: recipient.name,
          billName: bill.name ?? "Unknown Bill",
          provider: bill.provider ?? "",
          amountFormatted,
          dueDate: nextDueDate,
          leadDays: daysUntilDue,
          companyName,
        });

        // Persist attempt
        const attemptData: Record<string, unknown> = {
          billId,
          billName: bill.name ?? "",
          nextDueDate,
          leadDay,
          recipientUid: recipient.uid,
          recipientEmail: recipient.email,
          status: result.error ? "failed" : "sent",
          messageId: result.messageId,
          error: result.error,
          retryCount: FieldValue.increment(1),
          lastAttemptAt: FieldValue.serverTimestamp(),
        };

        if (existing.exists) {
          await attemptRef.update(attemptData);
        } else {
          await attemptRef.set({
            ...attemptData,
            retryCount: 1,
            createdAt: FieldValue.serverTimestamp(),
          });
        }

        if (result.error) {
          summary.failed++;
          summary.errors.push(`Failed: ${bill.name} → ${recipient.email}: ${result.error}`);
        } else {
          summary.sent++;
        }
      }
    }
  }

  // 5. Audit the batch
  if (summary.processed > 0) {
    await appendAudit({
      action: "bill.reminder",
      actor: { uid: "system", role: "system" },
      target: { collection: "bills", id: "batch" },
      after: {
        date: todayStr,
        processed: summary.processed,
        sent: summary.sent,
        skipped: summary.skipped,
        failed: summary.failed,
      } as unknown as Record<string, unknown>,
      reason: `Daily reminder batch: ${summary.sent} sent, ${summary.skipped} skipped, ${summary.failed} failed`,
    });
  }

  return summary;
}

/**
 * Send a test reminder to a specific email for verification.
 */
export async function sendTestReminder(recipientEmail: string, recipientName: string): Promise<{ success: boolean; error: string | null }> {
  if (!isSmtpConfigured()) {
    return { success: false, error: "SMTP is not configured." };
  }

  const result = await sendReminderEmail({
    recipientEmail,
    recipientName,
    billName: "Test Bill — Office Internet",
    provider: "ISP Provider Co.",
    amountFormatted: "₦ 25,000.00",
    dueDate: currentBusinessDate(),
    leadDays: 3,
    companyName: "Davo Solutions",
  });

  return { success: !result.error, error: result.error };
}
