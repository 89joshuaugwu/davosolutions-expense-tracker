import "server-only";

import { getAdminDb } from "../../firebase/admin";
import type { ExchangeRate } from "../../../domain/models";
import type { CurrencyCode } from "../../../domain/money";
import type { DateOnly } from "../../../domain/dates";

function docToExchangeRate(id: string, data: FirebaseFirestore.DocumentData): ExchangeRate {
  return {
    id,
    fromCurrency: data["fromCurrency"] as CurrencyCode,
    toCurrency: data["toCurrency"] as CurrencyCode,
    rate: String(data["rate"]),
    effectiveFrom: String(data["effectiveFrom"]) as DateOnly,
    setBy: String(data["setBy"] ?? "system"),
    createdAt: typeof data["createdAt"] === "string" ? data["createdAt"] : new Date().toISOString(),
    supersededAt: typeof data["supersededAt"] === "string" ? data["supersededAt"] : null,
  };
}

/**
 * Returns the most recently effective active rate for a currency pair on or before the given date.
 * Returns null if no rate is configured — callers must treat a missing rate as an error,
 * never silently fall back to a rate of 1.
 *
 * For the base currency converting to itself, callers should use the identity snapshot directly
 * without consulting this repository.
 */
export async function getEffectiveRate(
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  onDate: DateOnly,
): Promise<ExchangeRate | null> {
  if (fromCurrency === toCurrency) return null; // Identity; caller uses createMoneySnapshot directly.

  const db = getAdminDb();
  const snapshot = await db
    .collection("exchangeRates")
    .where("fromCurrency", "==", fromCurrency)
    .where("toCurrency", "==", toCurrency)
    .where("supersededAt", "==", null)
    .where("effectiveFrom", "<=", onDate)
    .orderBy("effectiveFrom", "desc")
    .limit(1)
    .get();

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0]!;
  return docToExchangeRate(doc.id, doc.data());
}

/**
 * Reads the current effective rate inside a transaction.
 */
export async function getEffectiveRateInTransaction(
  transaction: FirebaseFirestore.Transaction,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  onDate: DateOnly,
): Promise<ExchangeRate | null> {
  if (fromCurrency === toCurrency) return null;

  const db = getAdminDb();
  // Firestore transactions require all reads before writes; this is a read-only call.
  const snapshot = await transaction.get(
    db
      .collection("exchangeRates")
      .where("fromCurrency", "==", fromCurrency)
      .where("toCurrency", "==", toCurrency)
      .where("supersededAt", "==", null)
      .where("effectiveFrom", "<=", onDate)
      .orderBy("effectiveFrom", "desc")
      .limit(1),
  );

  if (snapshot.empty) return null;
  const doc = snapshot.docs[0]!;
  return docToExchangeRate(doc.id, doc.data());
}
