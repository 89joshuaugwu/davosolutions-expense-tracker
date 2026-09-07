import type { UserProfile } from "../lib/auth/model";
import type { AuditEvent } from "../lib/server/audit-model";
import type { DateOnly, ReportingMonth } from "./dates";
import type { CurrencyCode, MoneySnapshot } from "./money";

/** Domain DTOs use UTC ISO timestamps. Convert Firestore Timestamp at the repository boundary. */
export type IsoTimestamp = string;
export type { UserProfile, Role, UserStatus, OperationalPermissions } from "../lib/auth/model";
export type Frequency = "one_time" | "daily" | "monthly" | "yearly";
export type CatalogStatus = "active" | "archived";
export type ExpenseKind = "general" | "salary" | "transport" | "bill" | "other";

export interface AttachmentReference {
  readonly id: string;
  readonly storageKey: string;
  readonly provider: "firebase_storage" | "cloudinary";
  readonly fileName: string;
  readonly contentType: string;
  readonly sizeBytes: number;
  readonly uploadedBy: string;
  readonly uploadedAt: IsoTimestamp;
  // Never persist a public download URL; authorize access before issuing a short-lived URL.
}

export interface RecordMetadata {
  readonly id: string;
  readonly createdBy: string;
  readonly createdAt: IsoTimestamp;
  readonly updatedAt: IsoTimestamp;
  readonly archivedAt: IsoTimestamp | null;
  readonly archivedBy: string | null;
  /** Increment inside the correction transaction to reject stale writes. */
  readonly revision: number;
}

export interface Evidence {
  readonly notes: string;
  readonly attachments: readonly AttachmentReference[];
}

export interface OperationalVisibility {
  /** Admin-maintained assignment IDs; clients cannot widen this array. */
  readonly visibleToUserIds: readonly string[];
}

export interface ExpenseRecord extends RecordMetadata, Evidence, OperationalVisibility, MoneySnapshot {
  readonly kind: "expense";
  readonly title: string;
  readonly categoryId: string;
  readonly date: DateOnly;
  readonly frequency: Frequency;
  /** Only general/other costs live here; specialized logs post directly to ledgerEntries. */
  readonly expenseKind: "general" | "other";
}

interface SalaryRecordBase extends RecordMetadata, Evidence, OperationalVisibility, MoneySnapshot {
  readonly kind: "salary";
  readonly workerName: string;
  readonly workerRef: string | null;
  readonly period: ReportingMonth;
  readonly categoryId: string;
}

export type SalaryLog = SalaryRecordBase & (
  | { readonly status: "pending"; readonly paymentDate: DateOnly | null }
  | { readonly status: "paid"; readonly paymentDate: DateOnly }
);

export interface TransportLog extends RecordMetadata, Evidence, OperationalVisibility, MoneySnapshot {
  readonly kind: "transport";
  readonly date: DateOnly;
  readonly categoryId: string;
  /** Original-currency minor units; sum these BEFORE a single conversion. */
  readonly morningAmountMinor: number;
  readonly eveningAmountMinor: number;
  readonly extraAmountMinor: number;
  readonly extraReason: string;
}

/** A schedule/expected cost only. Creating or reminding a bill never posts an expense. */
export interface Bill extends RecordMetadata, Evidence, OperationalVisibility {
  readonly kind: "bill";
  readonly name: string;
  readonly categoryId: string;
  readonly provider: string;
  readonly amountMinor: number;
  readonly currency: CurrencyCode;
  readonly frequency: Frequency;
  readonly nextDueDate: DateOnly;
  readonly reminderDays: readonly number[];
  readonly responsibleUserId: string | null;
  readonly status: "active" | "paused" | "completed";
}

export interface BillPayment extends RecordMetadata, Evidence, OperationalVisibility, MoneySnapshot {
  readonly billId: string;
  /** Stable billed occurrence, not the date a user presses Pay. */
  readonly occurrenceDate: DateOnly;
  readonly paymentDate: DateOnly;
  readonly categoryId: string;
  readonly ledgerEntryId: string;
}

export interface MonthlyFund extends RecordMetadata, Evidence, MoneySnapshot {
  /** id MUST equal month; no implicit carry-forward from a prior closing balance. */
  readonly month: ReportingMonth;
  readonly source: string;
}

export interface RevenueRecord extends RecordMetadata, Evidence, MoneySnapshot {
  readonly date: DateOnly;
  readonly sourceId: string;
  readonly description: string;
}

export interface Category {
  readonly id: string;
  readonly name: string;
  readonly type: ExpenseKind;
  readonly status: CatalogStatus;
  readonly sortOrder: number;
}

export interface RevenueSource {
  readonly id: string;
  readonly name: string;
  readonly status: CatalogStatus;
  readonly sortOrder: number;
}

export interface ExchangeRate {
  readonly id: string;
  readonly fromCurrency: CurrencyCode;
  readonly toCurrency: CurrencyCode;
  readonly rate: string;
  readonly effectiveFrom: DateOnly;
  readonly setBy: string;
  readonly createdAt: IsoTimestamp;
  readonly supersededAt: IsoTimestamp | null;
}

export type AuditAction = AuditEvent["action"];

/** Persist the canonical runtime-validated audit shape; only the repository adds id/timestamp. */
export interface AuditLog extends AuditEvent {
  readonly id: string;
  readonly timestamp: IsoTimestamp;
}

export interface CompanySettings {
  readonly id: "company";
  readonly companyName: string;
  readonly logoStorageKey: string | null;
  readonly baseCurrency: CurrencyCode;
  readonly enabledCurrencies: readonly CurrencyCode[];
  /** Set atomically on the first monetary record; thereafter changing the base requires a migration. */
  readonly baseCurrencyLockedAt: IsoTimestamp | null;
  readonly fiscalYearStartMonth: number;
  readonly timezone: string;
  readonly reminderRecipientUserIds: readonly string[];
  readonly reminderDays: readonly number[];
  readonly updatedBy: string;
  readonly updatedAt: IsoTimestamp;
}

/** Stable server-only registry. UI-specific projections must deliberately omit restricted data. */
export interface CollectionDocuments {
  readonly users: UserProfile;
  readonly expenses: ExpenseRecord;
  readonly salaryLogs: SalaryLog;
  readonly transportLogs: TransportLog;
  readonly bills: Bill;
  readonly billPayments: BillPayment;
  readonly monthlyFunds: MonthlyFund;
  readonly revenue: RevenueRecord;
  readonly revenueSources: RevenueSource;
  readonly categories: Category;
  readonly exchangeRates: ExchangeRate;
  readonly auditLogs: AuditLog;
  readonly settings: CompanySettings;
  readonly ledgerEntries: import("./ledger").LedgerPosting;
}
