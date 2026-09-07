"use client";

import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { Banknote, Loader2, Plus, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { db } from "@/lib/firebase";
import { getAdminFundingForWorkspace, createAdminFunding, subscribePaymentMethods, getGlobalSettings } from "@/lib/firestore-helpers";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { AppUser, PaymentMethod, AdminFunding, GlobalSettings } from "@/types";

export default function AdminFundingPage() {
  const { user, profile, loading } = useAuth();
  
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodTitle, setSelectedPaymentMethodTitle] = useState("");
  
  const [amount, setAmount] = useState("");
  const [currencyMode, setCurrencyMode] = useState<"USD" | "NGN">("USD");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  
  const [fundingHistory, setFundingHistory] = useState<AdminFunding[]>([]);
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  // Load global settings
  useEffect(() => {
    getGlobalSettings().then(setSettings);
  }, []);

  // Load all users
  useEffect(() => {
    if (profile?.role !== "super_admin") return;
    const unsub = onSnapshot(query(collection(db, "users"), orderBy("createdAt", "desc")), (snap) => {
      setUsers(snap.docs.map((item) => ({ id: item.id, ...item.data() } as AppUser)));
    });
    return unsub;
  }, [profile?.role]);

  // Load payment methods for selected user
  useEffect(() => {
    if (!selectedUserId) {
      setPaymentMethods([]);
      setSelectedPaymentMethodTitle("");
      return;
    }
    const unsub = subscribePaymentMethods((rows) => {
      setPaymentMethods(rows);
      if (rows.length > 0) {
        setSelectedPaymentMethodTitle(rows[0]?.title ?? "");
      } else {
        setSelectedPaymentMethodTitle("");
      }
    }, selectedUserId);
    return unsub;
  }, [selectedUserId]);

  // Load history
  const loadHistory = () => {
    getAdminFundingForWorkspace("all").then(setFundingHistory);
  };
  useEffect(() => {
    if (profile?.role === "super_admin") loadHistory();
  }, [profile?.role]);

  const handleFund = async () => {
    if (!selectedUserId || !selectedPaymentMethodTitle || !amount || isNaN(Number(amount))) return;
    setBusy(true);
    setMessage("");
    
    let amountUsd = Number(amount);
    if (currencyMode === "NGN" && settings) {
      amountUsd = amountUsd / settings.usdToNairaRate;
    }

    try {
      await createAdminFunding({
        workspaceId: selectedUserId,
        amountUsd,
        paymentMethodTitle: selectedPaymentMethodTitle,
        date: new Date(date).getTime(),
      });
      setMessage("Funding logged successfully.");
      setAmount("");
      loadHistory();
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      setMessage(err.message || "Failed to log funding.");
    } finally {
      setBusy(false);
    }
  };

  if (loading || !user) return <main className="flex min-h-screen items-center justify-center bg-navy"><Loader2 className="animate-spin text-white" /></main>;
  if (profile?.role !== "super_admin") return <AppShell><div className="mx-auto max-w-3xl px-4 py-8"><section className="app-surface p-6 text-sm text-ink-soft">Restricted to super admin.</section></div></AppShell>;

  return (
    <AppShell>
      <div className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <div>
          <p className="eyebrow">Platform administration</p>
          <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Admin Funding</h1>
          <p className="mt-1 text-sm text-ink-soft">Fund sub-admins and track balances.</p>
        </div>

        <section className="app-surface p-6">
          <div className="flex items-center gap-2 mb-6">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
              <Banknote size={20} />
            </span>
            <h2 className="font-display text-xl font-bold text-ink">Log New Funding</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Sub Admin</label>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className="w-full rounded-xl border border-line bg-canvas/50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
              >
                <option value="">Select a user...</option>
                {users.map(u => (
                  <option key={u.id} value={u.workspaceId}>{u.displayName || u.email}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Payment Method</label>
              <select
                value={selectedPaymentMethodTitle}
                onChange={(e) => setSelectedPaymentMethodTitle(e.target.value)}
                disabled={!selectedUserId || paymentMethods.length === 0}
                className="w-full rounded-xl border border-line bg-canvas/50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white disabled:opacity-60"
              >
                {paymentMethods.length === 0 ? (
                  <option value="">No saved methods</option>
                ) : (
                  paymentMethods.map(pm => (
                    <option key={pm.id} value={pm.title}>{pm.title}</option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft flex justify-between">
                <span>Amount</span>
                <button
                  onClick={() => setCurrencyMode(currencyMode === "USD" ? "NGN" : "USD")}
                  className="text-primary hover:underline"
                >
                  Switch to {currencyMode === "USD" ? "NGN" : "USD"}
                </button>
              </label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-sm font-semibold text-ink-soft">
                  {currencyMode === "USD" ? "$" : "₦"}
                </span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-line bg-canvas/50 pl-7 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-ink-soft">Date</label>
              <div className="relative">
                <span className="absolute left-3 top-2.5 text-ink-soft"><Calendar size={16} /></span>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-xl border border-line bg-canvas/50 pl-10 pr-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
                />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            {message ? (
              <p className="text-sm font-semibold text-success">{message}</p>
            ) : (
              <div>
                 {currencyMode === "NGN" && amount && settings && (
                    <p className="text-xs text-ink-soft">Will be logged as ~{formatCurrency(Number(amount) / settings.usdToNairaRate)}</p>
                 )}
              </div>
            )}
            <button
              disabled={busy || !selectedUserId || !selectedPaymentMethodTitle || !amount}
              onClick={handleFund}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-50"
            >
              <Plus size={16} /> {busy ? "Logging..." : "Log Funding"}
            </button>
          </div>
        </section>

        <section className="app-surface overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink">Funding History</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/50">
                  <th className="px-5 py-3 font-semibold text-ink-soft">Date</th>
                  <th className="px-5 py-3 font-semibold text-ink-soft">Sub Admin</th>
                  <th className="px-5 py-3 font-semibold text-ink-soft">Payment Method</th>
                  <th className="px-5 py-3 text-right font-semibold text-ink-soft">Amount (USD)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fundingHistory.map((item) => {
                  const subAdmin = users.find(u => u.workspaceId === item.workspaceId);
                  return (
                    <tr key={item.id} className="transition hover:bg-canvas/30">
                      <td className="px-5 py-3 text-ink">{formatDate(item.date)}</td>
                      <td className="px-5 py-3 text-ink font-medium">{subAdmin?.displayName || subAdmin?.email || "Unknown"}</td>
                      <td className="px-5 py-3 text-ink-soft">{item.paymentMethodTitle}</td>
                      <td className="px-5 py-3 text-right text-success font-bold">{formatCurrency(item.amountUsd)}</td>
                    </tr>
                  )
                })}
                {fundingHistory.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-ink-soft">No funding history yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </AppShell>
  );
}
