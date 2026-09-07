"use client";

import { CalendarDays, DollarSign, Loader2, Save, TrendingDown, TrendingUp, Plus, Pencil, Trash } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { getDailyEntriesInRange, getDailyRevenue, saveDailyRevenue, getAllDailyRevenues, deleteDailyRevenue } from "@/lib/firestore-helpers";
import { formatCurrency, formatInputDate, todayInputDate } from "@/lib/utils";
import type { DailyEntry, DailyRevenue } from "@/types";

const dayBounds = (day: string) => { const [year = 1970, month = 1, date = 1] = day.split("-").map(Number); return { start: new Date(year, month - 1, date).getTime(), end: new Date(year, month - 1, date + 1).getTime() - 1 }; };

export default function DailyRevenuePage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return formatInputDate(d.getTime());
  });
  const [endDate, setEndDate] = useState(() => todayInputDate());

  const [revenues, setRevenues] = useState<DailyRevenue[]>([]);
  const [entries, setEntries] = useState<DailyEntry[]>([]);
  
  const [fetching, setFetching] = useState(true);
  const [loadError, setLoadError] = useState("");
  
  // Editor State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formDay, setFormDay] = useState(todayInputDate());
  const [usd, setUsd] = useState("");
  const [rate, setRate] = useState("1600");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);
  useEffect(() => { if (profile && profile.role !== "super_admin") router.replace("/dashboard"); }, [profile, router]);

  const loadData = useCallback(async () => {
    try {
      const startMs = dayBounds(startDate).start;
      const endMs = dayBounds(endDate).end;
      const [revs, ents] = await Promise.all([
        getAllDailyRevenues(startDate, endDate),
        getDailyEntriesInRange(startMs, endMs, "all")
      ]);
      setRevenues(revs);
      setEntries(ents);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load revenue records. Check your connection and Firestore indexes.");
    } finally {
      setFetching(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!user || profile?.role !== "super_admin") return;
    void Promise.resolve().then(loadData);
  }, [user, profile?.role, loadData]);

  const totalSpent = useMemo(() => entries.reduce((acc, e) => acc + e.spend, 0), [entries]);
  const totalRevenue = useMemo(() => revenues.reduce((acc, r) => acc + (r.revenueUsd * r.exchangeRate), 0), [revenues]);
  const netProfit = totalRevenue - totalSpent;

  const handleEdit = (rev: DailyRevenue) => {
    setEditingId(rev.id);
    setFormDay(rev.day);
    setUsd(String(rev.revenueUsd));
    setRate(String(rev.exchangeRate));
    setNote(rev.note || "");
    setShowForm(true);
  };

  const handleAddNew = () => {
    setEditingId(null);
    setFormDay(todayInputDate());
    setUsd("");
    setRate("1600");
    setNote("");
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Archive this revenue record? You can restore it from the audit history if needed.")) return;
    setBusy(true);
    try {
      await deleteDailyRevenue(id);
      await loadData();
    } catch (e) {
      setMessage("Unable to archive the revenue record.");
    } finally {
      setBusy(false);
    }
  };

  async function save() {
    setBusy(true);
    setMessage("");
    try {
      await saveDailyRevenue({ id: editingId || undefined, day: formDay, revenueUsd: Number(usd), exchangeRate: Number(rate), note });
      setMessage("Daily revenue saved.");
      setShowForm(false);
      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save.");
    } finally {
      setBusy(false);
    }
  }

  if (loading || !user || !profile) return <main className="flex min-h-screen items-center justify-center bg-navy"><Loader2 className="animate-spin text-white" /></main>;

  return (
    <AppShell>
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-5 sm:px-6 sm:py-7">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="eyebrow">Financial Signal</p>
            <h1 className="mt-1 font-display text-2xl font-extrabold tracking-tight text-ink">Daily Revenue</h1>
            <p className="mt-1 max-w-2xl text-sm text-ink-soft">Track AdSense revenue against all ad spend globally.</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="app-surface flex items-center gap-2 px-3 py-2 text-sm font-semibold text-ink">
              <span className="text-xs text-ink-soft">From:</span>
              <input type="date" value={startDate} onChange={(e) => { setFetching(true); setStartDate(e.target.value); }} className="bg-transparent outline-none" />
            </label>
            <label className="app-surface flex items-center gap-2 px-3 py-2 text-sm font-semibold text-ink">
              <span className="text-xs text-ink-soft">To:</span>
              <input type="date" value={endDate} onChange={(e) => { setFetching(true); setEndDate(e.target.value); }} className="bg-transparent outline-none" />
            </label>
          </div>
        </header>
        {loadError && <p className="rounded-xl border border-danger/20 bg-danger-soft px-4 py-3 text-sm text-danger">Could not load financial data: {loadError}</p>}

        <section className="grid gap-3 sm:grid-cols-3">
          <Metric icon={TrendingDown} label="Total Ad Spend" value={formatCurrency(totalSpent)} tone="text-danger" />
          <Metric icon={DollarSign} label="Total Revenue (NGN)" value={formatCurrency(totalRevenue)} sub={`${revenues.reduce((a,r) => a + r.revenueUsd, 0).toLocaleString()} USD`} tone="text-primary" />
          <Metric icon={netProfit >= 0 ? TrendingUp : TrendingDown} label={netProfit >= 0 ? "Net Profit" : "Net Loss"} value={formatCurrency(netProfit)} tone={netProfit >= 0 ? "text-success" : "text-danger"} />
        </section>

        {showForm && (
          <section className="app-surface p-5 sm:p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-ink">{editingId ? "Edit Revenue" : "Record Revenue"}</h2>
              <button onClick={() => setShowForm(false)} className="text-sm font-semibold text-ink-soft hover:text-ink">Cancel</button>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Date">
                <input type="date" value={formDay} onChange={(e) => setFormDay(e.target.value)} disabled={!!editingId} className="field" />
              </Field>
              <Field label="AdSense revenue (USD)">
                <input inputMode="decimal" value={usd} onChange={(e) => setUsd(e.target.value)} placeholder="0.00" className="field" />
              </Field>
              <Field label="USD to NGN rate">
                <input inputMode="decimal" value={rate} onChange={(e) => setRate(e.target.value)} placeholder="1600" className="field" />
              </Field>
            </div>
            <div className="mt-4">
              <Field label="Note (optional)">
                <textarea value={note} onChange={(e) => setNote(e.target.value)} className="field h-20 resize-y" />
              </Field>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button disabled={busy || !usd || !rate} onClick={save} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:bg-primary-hover disabled:opacity-50">
                <Save size={16} /> {busy ? "Saving…" : "Save Revenue"}
              </button>
            </div>
            {message && <p className="mt-3 rounded-xl bg-success-soft px-3 py-2 text-sm text-success">{message}</p>}
          </section>
        )}

        <section className="app-surface overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <h2 className="font-display text-lg font-bold text-ink">Revenue Logs</h2>
            {!showForm && (
              <button onClick={handleAddNew} className="flex items-center gap-2 rounded-full bg-primary-soft px-3 py-1.5 text-xs font-bold text-primary transition hover:bg-primary/20">
                <Plus size={14} /> Add Log
              </button>
            )}
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-canvas/50">
                  <th className="px-5 py-3 font-semibold text-ink-soft">Date</th>
                  <th className="px-5 py-3 text-right font-semibold text-ink-soft">USD</th>
                  <th className="px-5 py-3 text-right font-semibold text-ink-soft">Rate</th>
                  <th className="px-5 py-3 text-right font-semibold text-ink-soft">NGN</th>
                  <th className="px-5 py-3 font-semibold text-ink-soft">Note</th>
                  <th className="px-5 py-3 text-right font-semibold text-ink-soft">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {fetching ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-ink-soft"><Loader2 className="mx-auto animate-spin" /></td></tr>
                ) : revenues.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-8 text-center text-ink-soft">No revenue logs in this period.</td></tr>
                ) : (
                  revenues.map((rev) => (
                    <tr key={rev.id} className="transition hover:bg-canvas/30">
                      <td className="px-5 py-3 font-medium text-ink">{rev.day}</td>
                      <td className="px-5 py-3 text-right text-success font-semibold">${rev.revenueUsd.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right text-ink-soft">₦{rev.exchangeRate.toLocaleString()}</td>
                      <td className="px-5 py-3 text-right font-bold text-ink">{formatCurrency(rev.revenueUsd * rev.exchangeRate)}</td>
                      <td className="px-5 py-3 text-ink-soft truncate max-w-[200px]">{rev.note || "-"}</td>
                      <td className="px-5 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => handleEdit(rev)} className="rounded p-1 text-ink-soft hover:bg-line hover:text-ink"><Pencil size={15} /></button>
                          <button onClick={() => handleDelete(rev.id)} className="rounded p-1 text-danger/70 hover:bg-danger/10 hover:text-danger"><Trash size={15} /></button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="app-surface overflow-hidden">
          <div className="border-b border-line px-5 py-4"><h2 className="font-display text-lg font-bold text-ink">Ad Spend Logs</h2><p className="mt-0.5 text-xs text-ink-soft">The individual spend records included in the total above.</p></div>
          <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b border-line bg-canvas/50"><th className="px-5 py-3 font-semibold text-ink-soft">Date</th><th className="px-5 py-3 font-semibold text-ink-soft">Gmail</th><th className="px-5 py-3 font-semibold text-ink-soft">Business / Ads account</th><th className="px-5 py-3 text-right font-semibold text-ink-soft">Spend</th><th className="px-5 py-3 text-right font-semibold text-ink-soft">CPA</th><th className="px-5 py-3 font-semibold text-ink-soft">Note</th></tr></thead><tbody className="divide-y divide-line">{fetching ? <tr><td colSpan={6} className="px-5 py-8 text-center text-ink-soft">Loading spend logs…</td></tr> : entries.length === 0 ? <tr><td colSpan={6} className="px-5 py-8 text-center text-ink-soft">No ad spend logs in this period.</td></tr> : entries.map((entry) => <tr key={entry.id} className="hover:bg-canvas/30"><td className="whitespace-nowrap px-5 py-3 text-ink">{new Date(entry.date).toLocaleDateString("en-NG")}</td><td className="max-w-[180px] truncate px-5 py-3 text-ink-soft">{entry.gmailEmail}</td><td className="max-w-[240px] truncate px-5 py-3 text-ink-soft">{entry.businessName} · {entry.adsName}</td><td className="px-5 py-3 text-right font-bold text-danger">{formatCurrency(entry.spend)}</td><td className="px-5 py-3 text-right text-ink-soft">{entry.cpa.toLocaleString()}</td><td className="max-w-[220px] truncate px-5 py-3 text-ink-soft">{entry.note || "-"}</td></tr>)}</tbody></table></div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <label className="block text-sm font-semibold text-ink"><span>{label}</span><div className="mt-1.5 [&_.field]:w-full [&_.field]:rounded-xl [&_.field]:border [&_.field]:border-line [&_.field]:bg-canvas/50 [&_.field]:px-3 [&_.field]:py-2.5 [&_.field]:text-sm [&_.field]:font-normal [&_.field]:text-ink [&_.field]:outline-none [&_.field]:transition [&_.field]:focus:border-primary [&_.field]:focus:bg-white">{children}</div></label>; }
function Metric({ icon: Icon, label, value, sub, tone }: { icon: typeof DollarSign; label: string; value: string; sub?: string; tone: string }) { return <article className="app-surface p-4"><span className={`grid h-9 w-9 place-items-center rounded-xl bg-canvas ${tone}`}><Icon size={18} /></span><p className="mt-4 text-xs font-semibold text-ink-soft">{label}</p><p className={`mt-1 font-display text-xl font-extrabold tracking-tight ${tone}`}>{value}</p>{sub && <p className="mt-1 text-xs text-ink-soft">{sub}</p>}</article>; }
