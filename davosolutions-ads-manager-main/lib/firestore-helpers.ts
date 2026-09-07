import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, onSnapshot,
  orderBy, query, updateDoc, setDoc, where, writeBatch,
} from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { MAX_ADS_PER_BUSINESS, MAX_BUSINESS_PER_GMAIL } from "@/lib/utils";
import type { AdCreationStatus, AdsAccount, AdsStatus, BusinessAccount, Card, CardStatus, DailyEntry, DailyRevenue, GmailAccount, GmailStatus, Transaction, GlobalSettings, PaymentMethod, AdminFunding, AuditLog } from "@/types";

const gmailCol = collection(db, "gmailAccounts");
const businessCol = collection(db, "businessAccounts");
const adsCol = collection(db, "adsAccounts");
const txCol = collection(db, "transactions");
const entriesCol = collection(db, "dailyEntries");
const cardsCol = collection(db, "cards");
const revenueCol = collection(db, "dailyRevenue");
const settingsCol = collection(db, "settings");
const paymentMethodsCol = collection(db, "paymentMethods");
const adminFundingCol = collection(db, "adminFunding");

type Scope = { uid: string; workspaceId: string };

async function recordActivity(action: string, entityType: AuditLog["entityType"], entityId: string, entityLabel?: string, details?: Record<string, unknown>) {
  try {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return;
    await fetch("/api/audit", { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, entityType, entityId, entityLabel, details }) });
  } catch { /* Keep successful business writes independent from a temporary activity-feed failure. */ }
}

/** Resolve the signed-in user's workspace immediately before every query/write.
 * This deliberately avoids trusting workspace data stored in local state. */
async function currentScope(): Promise<Scope> {
  const user = auth.currentUser;
  if (!user) throw new Error("Please sign in again to continue.");
  const profile = await getDoc(doc(db, "users", user.uid));
  const data = profile.data();
  if (!profile.exists() || data?.active !== true || !data.workspaceId) {
    throw new Error("Your workspace is not ready. Ask an administrator to activate your account.");
  }
  return { uid: user.uid, workspaceId: data.workspaceId as string };
}

async function readScope(requestedWorkspaceId?: string | null): Promise<Scope> {
  const own = await currentScope();
  const profile = await getDoc(doc(db, "users", own.uid));
  const isSuper = profile.data()?.role === "super_admin";

  if (isSuper) {
    if (requestedWorkspaceId === "all" || !requestedWorkspaceId) {
      return { ...own, workspaceId: "all" };
    }
    return { ...own, workspaceId: requestedWorkspaceId };
  }
  return { ...own, workspaceId: own.workspaceId };
}

function scoped(ref: ReturnType<typeof collection>, workspaceId: string) {
  if (workspaceId === "all") return query(ref);
  return query(ref, where("workspaceId", "==", workspaceId));
}

function subscribeWorkspaceRows<T>(ref: ReturnType<typeof collection>, cb: (rows: T[]) => void, workspaceId?: string | null) {
  let unsubscribe: () => void = () => {};
  let cancelled = false;
  void readScope(workspaceId).then(({ workspaceId }) => {
    if (cancelled) return;
    unsubscribe = onSnapshot(scoped(ref, workspaceId), (snap) => cb(snap.docs.map((item) => ({ id: item.id, ...item.data() } as T))));
  }).catch(() => cb([]));
  return () => { cancelled = true; unsubscribe(); };
}

export function subscribeGmailAccounts(cb: (rows: GmailAccount[]) => void, workspaceId?: string | null) { return subscribeWorkspaceRows<GmailAccount>(gmailCol, cb, workspaceId); }
export function subscribeBusinessAccounts(cb: (rows: BusinessAccount[]) => void, workspaceId?: string | null) { return subscribeWorkspaceRows<BusinessAccount>(businessCol, cb, workspaceId); }
export function subscribeAdsAccounts(cb: (rows: AdsAccount[]) => void, workspaceId?: string | null) { return subscribeWorkspaceRows<AdsAccount>(adsCol, cb, workspaceId); }
export function subscribeCards(cb: (rows: Card[]) => void, workspaceId?: string | null, includeArchived = false) { return subscribeWorkspaceRows<Card>(cardsCol, (rows) => cb(includeArchived ? rows : rows.filter((row) => !row.deletedAt)), workspaceId); }

export async function createGmailAccount(data: { email: string; encryptedPassword: string; tiktokAccountName?: string; tiktokManagerName?: string; notes?: string; createdAt?: number }) {
  const scope = await currentScope(); const now = Date.now();
  const ref = await addDoc(gmailCol, { ...data, workspaceId: scope.workspaceId, ownerId: scope.uid, status: "active" as GmailStatus, createdAt: data.createdAt ?? now, updatedAt: now });
  await recordActivity("gmail_created", "gmailAccount", ref.id, data.email);
  return ref;
}

export async function updateGmailAccount(id: string, data: Partial<Pick<GmailAccount, "email" | "encryptedPassword" | "tiktokAccountName" | "tiktokManagerName" | "notes" | "status" | "createdAt">>) {
  await updateDoc(doc(gmailCol, id), { ...data, updatedAt: Date.now() });
  await recordActivity("gmail_updated", "gmailAccount", id, data.email);
}

export async function deleteGmailAccount(id: string) {
  const { workspaceId } = await currentScope(); const batch = writeBatch(db);
  const businesses = await getDocs(query(businessCol, where("workspaceId", "==", workspaceId), where("gmailAccountId", "==", id)));
  for (const business of businesses.docs) {
    const ads = await getDocs(query(adsCol, where("workspaceId", "==", workspaceId), where("businessAccountId", "==", business.id)));
    for (const ad of ads.docs) {
      const entries = await getDocs(query(entriesCol, where("workspaceId", "==", workspaceId), where("adsAccountId", "==", ad.id)));
      entries.docs.forEach((entry) => batch.delete(entry.ref)); batch.delete(ad.ref);
    }
    batch.delete(business.ref);
  }
  const transactions = await getDocs(query(txCol, where("workspaceId", "==", workspaceId), where("gmailAccountId", "==", id)));
  transactions.docs.forEach((transaction) => batch.delete(transaction.ref)); batch.delete(doc(gmailCol, id)); await batch.commit();
  await recordActivity("gmail_deleted", "gmailAccount", id);
}

export async function createBusinessAccount(gmailAccountId: string, gmailEmail: string, data: { name: string; officialDomain?: string; initialFunding?: number; createdAt?: number }) {
  const scope = await currentScope();
  const existing = await getDocs(query(businessCol, where("workspaceId", "==", scope.workspaceId), where("gmailAccountId", "==", gmailAccountId)));
  if (existing.size >= MAX_BUSINESS_PER_GMAIL) throw new Error(`This Gmail already has ${MAX_BUSINESS_PER_GMAIL} business accounts.`);
  const now = Date.now(); const funding = data.initialFunding ?? 0; const ref = doc(businessCol); const batch = writeBatch(db);
  batch.set(ref, { workspaceId: scope.workspaceId, ownerId: scope.uid, gmailAccountId, name: data.name, officialDomain: data.officialDomain ?? "", amountFunded: funding, amountLost: 0, totalCharges: 0, dateFunded: now, status: "active", createdAt: data.createdAt ?? now, updatedAt: now });
  if (funding > 0) batch.set(doc(txCol), { workspaceId: scope.workspaceId, ownerId: scope.uid, type: "funding", amount: funding, date: now, gmailAccountId, gmailEmail, businessAccountId: ref.id, businessName: data.name, note: "Initial funding", createdAt: now });
  await batch.commit(); await recordActivity("business_created", "businessAccount", ref.id, data.name, { initialFunding: funding }); return ref;
}

export async function updateBusinessAccount(id: string, data: Partial<Pick<BusinessAccount, "name" | "officialDomain" | "createdAt" | "totalCharges">>) { await updateDoc(doc(businessCol, id), { ...data, updatedAt: Date.now() }); await recordActivity("business_updated", "businessAccount", id, data.name); }

export async function addFundingToBusinessAccount(business: Pick<BusinessAccount, "id" | "amountFunded" | "totalCharges" | "gmailAccountId" | "name">, gmailEmail: string, amount: number, note?: string, card?: Pick<Card, "id" | "name" | "lastFourDigits">, charge?: number, overrideDate?: number) {
  if (amount <= 0) throw new Error("Funding amount must be greater than zero.");
  const scope = await currentScope(); const now = overrideDate || Date.now(); const batch = writeBatch(db);
  batch.update(doc(businessCol, business.id), { amountFunded: business.amountFunded + amount, totalCharges: (business.totalCharges || 0) + (charge ?? 0), updatedAt: Date.now() });
  const transaction = doc(txCol); batch.set(transaction, { workspaceId: scope.workspaceId, ownerId: scope.uid, type: "funding", amount, charge: charge ?? 0, date: now, gmailAccountId: business.gmailAccountId, gmailEmail, businessAccountId: business.id, businessName: business.name, cardId: card?.id ?? "", cardLabel: card ? `${card.name} •••• ${card.lastFourDigits}` : "", note: note ?? "", createdAt: Date.now() }); await batch.commit(); await recordActivity("business_funded", "transaction", transaction.id, business.name, { amount, charge: charge ?? 0 });

  // Low balance check
  try {
    const settings = await getGlobalSettings();
    if (settings.lowBalanceAlertEmail) {
      const fundings = await getAdminFundingForWorkspace(scope.workspaceId);
      const totalFundedUsd = fundings.reduce((acc, f) => acc + f.amountUsd, 0);
      const totalFundedNaira = totalFundedUsd * settings.usdToNairaRate;
      
      const txs = await getCardFundingTransactions(scope.workspaceId);
      const totalSpentNaira = txs.reduce((acc, tx) => acc + tx.amount + (tx.charge || 0), 0);
      
      const availableBalanceNaira = totalFundedNaira - totalSpentNaira;
      if (availableBalanceNaira <= 0) {
        const user = auth.currentUser;
        const token = await user?.getIdToken();
        if (token) {
          await fetch("/api/notify-low-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({
              subAdminEmail: user?.email,
              subAdminName: user?.displayName,
              availableBalanceNaira
            })
          }).catch(() => {}); // Fire and forget
        }
      }
    }
  } catch (e) {
    console.error("Failed to check low balance", e);
  }
}

export async function closeBusinessAccount(business: Pick<BusinessAccount, "id" | "amountFunded" | "gmailAccountId" | "name">, gmailEmail: string) {
  const scope = await currentScope(); const adsSnap = await getDocs(query(adsCol, where("workspaceId", "==", scope.workspaceId), where("businessAccountId", "==", business.id)));
  const totalSpent = adsSnap.docs.reduce((sum, row) => sum + (row.data().amountSpent ?? 0), 0); const lost = Math.max(0, business.amountFunded - totalSpent); const now = Date.now(); const batch = writeBatch(db);
  batch.update(doc(businessCol, business.id), { status: "closed", amountLost: lost, updatedAt: now }); adsSnap.docs.forEach((ad) => { if (ad.data().status !== "closed") batch.update(ad.ref, { status: "closed", updatedAt: now }); });
  if (lost > 0) batch.set(doc(txCol), { workspaceId: scope.workspaceId, ownerId: scope.uid, type: "loss", amount: lost, date: now, gmailAccountId: business.gmailAccountId, gmailEmail, businessAccountId: business.id, businessName: business.name, note: "Business account closed — unspent funding locked", createdAt: now }); await batch.commit(); await recordActivity("business_closed", "businessAccount", business.id, business.name, { lost });
}

export async function deleteBusinessAccount(id: string) {
  const { workspaceId } = await currentScope(); const batch = writeBatch(db); const ads = await getDocs(query(adsCol, where("workspaceId", "==", workspaceId), where("businessAccountId", "==", id)));
  for (const ad of ads.docs) { const entries = await getDocs(query(entriesCol, where("workspaceId", "==", workspaceId), where("adsAccountId", "==", ad.id))); entries.docs.forEach((entry) => batch.delete(entry.ref)); batch.delete(ad.ref); }
  const transactions = await getDocs(query(txCol, where("workspaceId", "==", workspaceId), where("businessAccountId", "==", id))); transactions.docs.forEach((transaction) => batch.delete(transaction.ref)); batch.delete(doc(businessCol, id)); await batch.commit(); await recordActivity("business_deleted", "businessAccount", id);
}

export async function createAdsAccount(businessAccountId: string, gmailAccountId: string, data: { name: string; destinationUrl?: string; createdAt?: number }) {
  const scope = await currentScope(); const existing = await getDocs(query(adsCol, where("workspaceId", "==", scope.workspaceId), where("businessAccountId", "==", businessAccountId)));
  if (existing.size >= MAX_ADS_PER_BUSINESS) throw new Error(`This business account already has ${MAX_ADS_PER_BUSINESS} ads accounts.`);
  const now = Date.now(); const ref = await addDoc(adsCol, { workspaceId: scope.workspaceId, ownerId: scope.uid, businessAccountId, gmailAccountId, name: data.name, destinationUrl: data.destinationUrl ?? "", amountSpent: 0, cpa: 0, status: "active" as AdsStatus, adStatus: "not_created" as AdCreationStatus, createdAt: data.createdAt ?? now, updatedAt: now }); await recordActivity("ads_created", "adsAccount", ref.id, data.name); return ref;
}
export async function updateAdsAccount(id: string, data: Partial<Pick<AdsAccount, "name" | "destinationUrl" | "adStatus" | "cpa" | "createdAt">>) { await updateDoc(doc(adsCol, id), { ...data, updatedAt: Date.now() }); await recordActivity("ads_updated", "adsAccount", id, data.name); }
export async function updateAdsAccountStatus(id: string, status: AdsStatus, invalidationReason?: string) { await updateDoc(doc(adsCol, id), { status, invalidationReason: invalidationReason ?? "", updatedAt: Date.now() }); await recordActivity("ads_status_changed", "adsAccount", id, undefined, { status }); }
export async function deleteAdsAccount(id: string) { const { workspaceId } = await currentScope(); const batch = writeBatch(db); const entries = await getDocs(query(entriesCol, where("workspaceId", "==", workspaceId), where("adsAccountId", "==", id))); entries.docs.forEach((entry) => batch.delete(entry.ref)); const transactions = await getDocs(query(txCol, where("workspaceId", "==", workspaceId), where("adsAccountId", "==", id))); transactions.docs.forEach((transaction) => batch.delete(transaction.ref)); batch.delete(doc(adsCol, id)); await batch.commit(); await recordActivity("ads_deleted", "adsAccount", id); }

async function recomputeAdsAccountTotals(adsAccountId: string) {
  const { workspaceId } = await currentScope(); const snap = await getDocs(query(entriesCol, where("workspaceId", "==", workspaceId), where("adsAccountId", "==", adsAccountId))); const rows = snap.docs.map((item) => item.data() as DailyEntry); const amountSpent = rows.reduce((sum, row) => sum + row.spend, 0); const latest = rows.reduce<DailyEntry | null>((acc, row) => (!acc || row.date >= acc.date ? row : acc), null); await updateDoc(doc(adsCol, adsAccountId), { amountSpent, cpa: latest?.cpa ?? 0, updatedAt: Date.now() });
}

export async function addDailyEntry(ads: Pick<AdsAccount, "id" | "name" | "gmailAccountId" | "businessAccountId">, business: Pick<BusinessAccount, "name">, gmailEmail: string, data: { date: number; spend: number; cpa: number; note?: string }) {
  if (data.spend < 0 || data.cpa < 0) throw new Error("Spend and CPA can't be negative.");
  const scope = await currentScope(); const now = Date.now(); const entry = doc(entriesCol); const batch = writeBatch(db);
  batch.set(entry, { workspaceId: scope.workspaceId, ownerId: scope.uid, adsAccountId: ads.id, adsName: ads.name, businessAccountId: ads.businessAccountId, businessName: business.name, gmailAccountId: ads.gmailAccountId, gmailEmail, date: data.date, spend: data.spend, cpa: data.cpa, note: data.note ?? "", createdAt: now });
  if (data.spend !== 0) batch.set(doc(txCol), { workspaceId: scope.workspaceId, ownerId: scope.uid, type: "spend", amount: data.spend, date: data.date, gmailAccountId: ads.gmailAccountId, gmailEmail, businessAccountId: ads.businessAccountId, businessName: business.name, adsAccountId: ads.id, adsName: ads.name, dailyEntryId: entry.id, note: data.note ?? "", createdAt: now });
  await batch.commit(); await recomputeAdsAccountTotals(ads.id); await recordActivity("daily_spend_logged", "dailyEntry", entry.id, ads.name, { spend: data.spend, cpa: data.cpa, date: data.date });
}

export async function updateDailyEntry(entry: Pick<DailyEntry, "id" | "adsAccountId">, data: { date: number; spend: number; cpa: number; note?: string }) {
  if (data.spend < 0 || data.cpa < 0) throw new Error("Spend and CPA can't be negative."); const { workspaceId } = await currentScope(); const now = Date.now(); const batch = writeBatch(db); batch.update(doc(entriesCol, entry.id), { ...data, note: data.note ?? "" }); const transactions = await getDocs(query(txCol, where("workspaceId", "==", workspaceId), where("dailyEntryId", "==", entry.id))); transactions.docs.forEach((transaction) => batch.update(transaction.ref, { amount: data.spend, date: data.date, note: data.note ?? "", updatedAt: now })); await batch.commit(); await recomputeAdsAccountTotals(entry.adsAccountId); await recordActivity("daily_spend_updated", "dailyEntry", entry.id, undefined, { spend: data.spend, cpa: data.cpa, date: data.date });
}

export async function deleteDailyEntry(entry: Pick<DailyEntry, "id" | "adsAccountId">) { const { uid, workspaceId } = await currentScope(); const now = Date.now(); const batch = writeBatch(db); batch.update(doc(entriesCol, entry.id), { deletedAt: now, deletedBy: uid }); const transactions = await getDocs(query(txCol, where("workspaceId", "==", workspaceId), where("dailyEntryId", "==", entry.id))); transactions.docs.forEach((transaction) => batch.update(transaction.ref, { deletedAt: now, deletedBy: uid })); await batch.commit(); await recomputeAdsAccountTotals(entry.adsAccountId); await recordActivity("daily_spend_archived", "dailyEntry", entry.id); }

export async function getDailyEntriesForAds(adsAccountId: string): Promise<DailyEntry[]> { const { workspaceId } = await currentScope(); const snap = await getDocs(query(entriesCol, where("workspaceId", "==", workspaceId), where("adsAccountId", "==", adsAccountId), orderBy("date", "desc"))); return snap.docs.map((item) => ({ id: item.id, ...item.data() } as DailyEntry)).filter((item) => !item.deletedAt); }
export async function getDailyEntriesInRange(startMs: number, endMs: number, requestedWorkspaceId?: string | null): Promise<DailyEntry[]> { const { workspaceId } = await readScope(requestedWorkspaceId); const q = workspaceId === "all" ? query(entriesCol, where("date", ">=", startMs), where("date", "<=", endMs), orderBy("date", "asc")) : query(entriesCol, where("workspaceId", "==", workspaceId), where("date", ">=", startMs), where("date", "<=", endMs), orderBy("date", "asc")); const snap = await getDocs(q); return snap.docs.map((item) => ({ id: item.id, ...item.data() } as DailyEntry)).filter((item) => !item.deletedAt); }
export async function getDailyRevenue(day: string): Promise<DailyRevenue | null> { const { workspaceId } = await currentScope(); const snap = await getDocs(query(revenueCol, where("day", "==", day))); const row = snap.docs[0]; return row ? ({ id: row.id, ...row.data() } as DailyRevenue) : null; }
export async function getAllDailyRevenues(startDay?: string, endDay?: string, includeArchived = false): Promise<DailyRevenue[]> { let q = query(revenueCol, orderBy("day", "desc")); if (startDay && endDay) { q = query(revenueCol, where("day", ">=", startDay), where("day", "<=", endDay), orderBy("day", "desc")); } const snap = await getDocs(q); return snap.docs.map((item) => ({ id: item.id, ...item.data() } as DailyRevenue)).filter((item) => includeArchived || !item.deletedAt); }
export async function saveDailyRevenue(input: { id?: string; day: string; revenueUsd: number; exchangeRate: number; note?: string }) { if (input.revenueUsd < 0 || input.exchangeRate <= 0) throw new Error("Revenue cannot be negative and exchange rate must be greater than zero."); const scope = await currentScope(); const now = Date.now(); const payload = { day: input.day, revenueUsd: input.revenueUsd, exchangeRate: input.exchangeRate, note: input.note ?? "", updatedAt: now }; let id = input.id; if (id) { await updateDoc(doc(revenueCol, id), payload); } else { const existing = await getDocs(query(revenueCol, where("day", "==", input.day))); if (existing.docs[0]) { id = existing.docs[0].id; await updateDoc(existing.docs[0].ref, payload); } else { const ref = await addDoc(revenueCol, { ...payload, workspaceId: scope.workspaceId, ownerId: scope.uid, createdAt: now }); id = ref.id; } } await recordActivity("daily_revenue_saved", "dailyRevenue", id!, input.day, { revenueUsd: input.revenueUsd, exchangeRate: input.exchangeRate }); return id; }
export async function deleteDailyRevenue(id: string) { const { uid } = await currentScope(); await updateDoc(doc(revenueCol, id), { deletedAt: Date.now(), deletedBy: uid }); await recordActivity("daily_revenue_archived", "dailyRevenue", id); }
export async function restoreDailyRevenue(id: string) { await updateDoc(doc(revenueCol, id), { deletedAt: null, deletedBy: null, updatedAt: Date.now() }); await recordActivity("daily_revenue_restored", "dailyRevenue", id); }
export async function getTransactionsInRange(startMs: number, endMs: number, requestedWorkspaceId?: string | null): Promise<Transaction[]> { const { workspaceId } = await readScope(requestedWorkspaceId); const q = workspaceId === "all" ? query(txCol, where("date", ">=", startMs), where("date", "<=", endMs), orderBy("date", "desc")) : query(txCol, where("workspaceId", "==", workspaceId), where("date", ">=", startMs), where("date", "<=", endMs), orderBy("date", "desc")); const snap = await getDocs(q); return snap.docs.map((item) => ({ id: item.id, ...item.data() } as Transaction)); }
export async function isEmailWhitelisted(email: string): Promise<boolean> { const snap = await getDoc(doc(collection(db, "whitelistedUsers"), email.toLowerCase())); return snap.exists(); }

export async function createCard(data: { name: string; lastFourDigits: string; businessAccountIds?: string[]; businessNames?: string[]; notes?: string }) { const scope = await currentScope(); const now = Date.now(); const ref = await addDoc(cardsCol, { workspaceId: scope.workspaceId, ownerId: scope.uid, name: data.name, lastFourDigits: data.lastFourDigits, businessAccountIds: data.businessAccountIds ?? [], businessNames: data.businessNames ?? [], status: "active" as CardStatus, notes: data.notes ?? "", createdAt: now, updatedAt: now }); await recordActivity("card_created", "card", ref.id, data.name); return ref; }
export async function updateCard(id: string, data: Partial<{ name: string; lastFourDigits: string; businessAccountIds: string[]; businessNames: string[]; status: CardStatus; notes: string }>) { await updateDoc(doc(cardsCol, id), { ...data, updatedAt: Date.now() }); await recordActivity("card_updated", "card", id, data.name); }
export async function deleteCard(id: string) { const { uid } = await currentScope(); await updateDoc(doc(cardsCol, id), { deletedAt: Date.now(), deletedBy: uid, status: "inactive", updatedAt: Date.now() }); await recordActivity("card_archived", "card", id); }
export async function restoreCard(id: string) { await updateDoc(doc(cardsCol, id), { deletedAt: null, deletedBy: null, status: "active", updatedAt: Date.now() }); await recordActivity("card_restored", "card", id); }
export async function getCardFundingTransactions(requestedWorkspaceId?: string | null): Promise<Transaction[]> { const { workspaceId } = await readScope(requestedWorkspaceId); const q = workspaceId === "all" ? query(txCol, where("type", "==", "funding")) : query(txCol, where("workspaceId", "==", workspaceId), where("type", "==", "funding")); const snap = await getDocs(q); return snap.docs.map((item) => ({ id: item.id, ...item.data() } as Transaction)).filter((transaction) => !!transaction.cardId); }

// Admin Funding System Functions

export async function getGlobalSettings(): Promise<GlobalSettings> {
  const snap = await getDoc(doc(settingsCol, "global"));
  if (snap.exists()) {
    return { id: snap.id, ...snap.data() } as GlobalSettings;
  }
  return { id: "global", usdToNairaRate: 1600, lowBalanceAlertEmail: "", updatedAt: Date.now() };
}

export async function updateGlobalSettings(data: Partial<Omit<GlobalSettings, "id" | "updatedAt">>) {
  await setDoc(doc(settingsCol, "global"), { ...data, updatedAt: Date.now() }, { merge: true });
  await recordActivity("global_settings_updated", "workspace", "global", "Global Settings");
}

export function subscribePaymentMethods(cb: (rows: PaymentMethod[]) => void, workspaceId?: string | null) {
  return subscribeWorkspaceRows<PaymentMethod>(paymentMethodsCol, cb, workspaceId);
}

export async function createPaymentMethod(data: { title: string; encryptedAddress: string }) {
  const scope = await currentScope();
  const now = Date.now();
  const ref = await addDoc(paymentMethodsCol, {
    workspaceId: scope.workspaceId,
    ownerId: scope.uid,
    title: data.title,
    encryptedAddress: data.encryptedAddress,
    createdAt: now,
    updatedAt: now,
  });
  await recordActivity("payment_method_created", "workspace", ref.id, data.title);
  return ref;
}

export async function updatePaymentMethod(id: string, data: Partial<{ title: string; encryptedAddress: string }>) {
  await updateDoc(doc(paymentMethodsCol, id), { ...data, updatedAt: Date.now() });
  await recordActivity("payment_method_updated", "workspace", id, data.title);
}

export async function deletePaymentMethod(id: string) {
  await deleteDoc(doc(paymentMethodsCol, id));
  await recordActivity("payment_method_deleted", "workspace", id);
}

export async function getAdminFundingForWorkspace(requestedWorkspaceId?: string | null): Promise<AdminFunding[]> {
  const { workspaceId } = await readScope(requestedWorkspaceId);
  const q = workspaceId === "all"
    ? query(adminFundingCol, orderBy("date", "desc"))
    : query(adminFundingCol, where("workspaceId", "==", workspaceId), orderBy("date", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((item) => ({ id: item.id, ...item.data() } as AdminFunding));
}

export async function createAdminFunding(data: { workspaceId: string; amountUsd: number; paymentMethodTitle: string; date: number }) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");
  const now = Date.now();
  const ref = await addDoc(adminFundingCol, {
    workspaceId: data.workspaceId,
    adminId: user.uid,
    amountUsd: data.amountUsd,
    paymentMethodTitle: data.paymentMethodTitle,
    date: data.date,
    createdAt: now,
  });
  await recordActivity("admin_funding_created", "workspace", ref.id, `Funded ${data.amountUsd} USD`);
  return ref;
}
