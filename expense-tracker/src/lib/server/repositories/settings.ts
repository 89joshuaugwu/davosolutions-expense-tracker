import "server-only";

import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "../../firebase/admin";
import type { CompanySettings } from "../../../domain/models";
import { DEFAULT_CURRENCY, type CurrencyCode } from "../../../domain/money";

const SETTINGS_DOC_ID = "company";

/** Default enabled currencies for v1. NGN is always enabled as the base. */
const DEFAULT_ENABLED_CURRENCIES: CurrencyCode[] = ["NGN", "USD", "GBP", "EUR"];

const DEFAULT_SETTINGS_DATA: Omit<CompanySettings, "id"> = {
  companyName: "Davo Solutions",
  logoStorageKey: null,
  baseCurrency: DEFAULT_CURRENCY,
  enabledCurrencies: DEFAULT_ENABLED_CURRENCIES,
  baseCurrencyLockedAt: null,
  fiscalYearStartMonth: 1,
  timezone: "Africa/Lagos",
  reminderRecipientUserIds: [],
  reminderDays: [7, 3, 1],
  updatedBy: "system",
  updatedAt: new Date().toISOString(),
};

/**
 * Reads the company settings document.
 * Returns null if settings have never been saved (first-run state).
 */
export async function getCompanySettings(): Promise<CompanySettings | null> {
  const db = getAdminDb();
  const snapshot = await db.collection("settings").doc(SETTINGS_DOC_ID).get();
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  return {
    id: "company",
    companyName: typeof data["companyName"] === "string" ? data["companyName"] : "Davo Solutions",
    logoStorageKey: typeof data["logoStorageKey"] === "string" ? data["logoStorageKey"] : null,
    baseCurrency: (data["baseCurrency"] as CurrencyCode) ?? DEFAULT_CURRENCY,
    enabledCurrencies: Array.isArray(data["enabledCurrencies"])
      ? (data["enabledCurrencies"] as CurrencyCode[])
      : DEFAULT_ENABLED_CURRENCIES,
    baseCurrencyLockedAt: typeof data["baseCurrencyLockedAt"] === "string" ? data["baseCurrencyLockedAt"] : null,
    fiscalYearStartMonth: typeof data["fiscalYearStartMonth"] === "number" ? data["fiscalYearStartMonth"] : 1,
    timezone: typeof data["timezone"] === "string" ? data["timezone"] : "Africa/Lagos",
    reminderRecipientUserIds: Array.isArray(data["reminderRecipientUserIds"])
      ? (data["reminderRecipientUserIds"] as string[])
      : [],
    reminderDays: Array.isArray(data["reminderDays"]) ? (data["reminderDays"] as number[]) : [7, 3, 1],
    updatedBy: typeof data["updatedBy"] === "string" ? data["updatedBy"] : "system",
    updatedAt: typeof data["updatedAt"] === "string" ? data["updatedAt"] : new Date().toISOString(),
  };
}

/**
 * Returns existing settings or creates default NGN settings on first call.
 * The base currency lock is set the first time a monetary record is created (not here).
 */
export async function getOrCreateDefaultSettings(): Promise<CompanySettings> {
  const existing = await getCompanySettings();
  if (existing) return existing;

  const db = getAdminDb();
  const now = new Date().toISOString();
  const defaults = { ...DEFAULT_SETTINGS_DATA, updatedAt: now };
  await db
    .collection("settings")
    .doc(SETTINGS_DOC_ID)
    .set({ ...defaults, createdAt: FieldValue.serverTimestamp() });

  return { id: "company", ...defaults };
}

/**
 * Lock the base currency atomically inside an existing transaction.
 * Called once when the very first monetary record (expense, salary, fund, revenue) is created.
 * Subsequent calls are no-ops if already locked.
 */
export function lockBaseCurrencyInTransaction(
  transaction: FirebaseFirestore.Transaction,
  currentSettings: CompanySettings,
): void {
  if (currentSettings.baseCurrencyLockedAt !== null) return;
  const db = getAdminDb();
  transaction.update(db.collection("settings").doc(SETTINGS_DOC_ID), {
    baseCurrencyLockedAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    updatedBy: "system",
  });
}

/**
 * Read settings inside a transaction to capture a consistent view before creating a record.
 */
export async function getSettingsInTransaction(
  transaction: FirebaseFirestore.Transaction,
): Promise<CompanySettings | null> {
  const db = getAdminDb();
  const snapshot = await transaction.get(db.collection("settings").doc(SETTINGS_DOC_ID));
  if (!snapshot.exists) return null;
  const data = snapshot.data()!;
  return {
    id: "company",
    companyName: typeof data["companyName"] === "string" ? data["companyName"] : "Davo Solutions",
    logoStorageKey: typeof data["logoStorageKey"] === "string" ? data["logoStorageKey"] : null,
    baseCurrency: (data["baseCurrency"] as CurrencyCode) ?? DEFAULT_CURRENCY,
    enabledCurrencies: Array.isArray(data["enabledCurrencies"])
      ? (data["enabledCurrencies"] as CurrencyCode[])
      : DEFAULT_ENABLED_CURRENCIES,
    baseCurrencyLockedAt:
      typeof data["baseCurrencyLockedAt"] === "string" ? data["baseCurrencyLockedAt"] : null,
    fiscalYearStartMonth: typeof data["fiscalYearStartMonth"] === "number" ? data["fiscalYearStartMonth"] : 1,
    timezone: typeof data["timezone"] === "string" ? data["timezone"] : "Africa/Lagos",
    reminderRecipientUserIds: Array.isArray(data["reminderRecipientUserIds"])
      ? (data["reminderRecipientUserIds"] as string[])
      : [],
    reminderDays: Array.isArray(data["reminderDays"]) ? (data["reminderDays"] as number[]) : [7, 3, 1],
    updatedBy: typeof data["updatedBy"] === "string" ? data["updatedBy"] : "system",
    updatedAt: typeof data["updatedAt"] === "string" ? data["updatedAt"] : new Date().toISOString(),
  };
}

/**
 * Updates the company settings with the provided partial data.
 */
export async function updateCompanySettings(
  updateData: Partial<Omit<CompanySettings, "id" | "baseCurrency" | "baseCurrencyLockedAt" | "createdAt" | "updatedAt">> & { updatedBy: string }
): Promise<CompanySettings> {
  const db = getAdminDb();
  
  await db.runTransaction(async (transaction) => {
    const docRef = db.collection("settings").doc(SETTINGS_DOC_ID);
    const snapshot = await transaction.get(docRef);
    
    if (!snapshot.exists) {
      throw new Error("Settings not found");
    }

    const updates = {
      ...updateData,
      updatedAt: FieldValue.serverTimestamp(),
    };
    
    transaction.update(docRef, updates);
  });

  const updatedSettings = await getCompanySettings();
  if (!updatedSettings) throw new Error("Failed to reload settings");
  return updatedSettings;
}
