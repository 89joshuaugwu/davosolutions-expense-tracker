"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Loader2, ReceiptText, RefreshCw } from "lucide-react";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/domain/money";
import type { Category } from "@/domain/models";
import type { Frequency } from "@/domain/models";

interface ExpenseItem {
  id: string;
  title: string;
  originalAmountMinor: number;
  currency: CurrencyCode;
  baseAmountMinor: number;
  baseCurrency: CurrencyCode;
  categoryId: string;
  date: string;
  frequency: Frequency;
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
  revision: number;
}

interface Props {
  initialMonth?: string;
}

const FREQUENCY_LABELS: Record<string, string> = {
  one_time: "One-time",
  daily: "Daily",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function ExpenseList({ initialMonth }: Props) {
  const [items, setItems] = useState<ExpenseItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [, setBaseCurrency] = useState<CurrencyCode>("NGN");
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [month, setMonth] = useState(initialMonth ?? new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const searchParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  
  // Filters state
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [categoryId, setCategoryId] = useState(searchParams.get("category") || "");
  const [currency, setCurrency] = useState(searchParams.get("currency") || "");
  const [frequency, setFrequency] = useState(searchParams.get("frequency") || "");
  
  const buildQueryString = useCallback((cursor?: string) => {
    const params = new URLSearchParams();
    if (month) params.set("month", month);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (categoryId) params.set("category", categoryId);
    if (currency) params.set("currency", currency);
    if (frequency) params.set("frequency", frequency);
    if (cursor) params.set("cursor", cursor);
    return params.toString();
  }, [month, startDate, endDate, categoryId, currency, frequency]);

  const fetchExpenses = useCallback(
    async (cursor?: string) => {
      const isLoadingMore = !!cursor;
      if (isLoadingMore) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        const qs = buildQueryString(cursor);
        const response = await fetch(`/api/expenses?${qs}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to load expenses.");
          return;
        }

        if (isLoadingMore) {
          setItems((prev) => [...prev, ...data.items]);
        } else {
          setItems(data.items);
        }
        setNextCursor(data.nextCursor);
        if (data.categories) setCategories(data.categories);
        if (data.baseCurrency) setBaseCurrency(data.baseCurrency);
      } catch {
        setError("Network error. Please check your connection.");
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [month],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const qs = buildQueryString();
        const response = await fetch(`/api/expenses?${qs}`);
        const data = await response.json();
        if (cancelled) return;
        if (!response.ok) { setError(data.error || "Failed to load expenses."); return; }
        setItems(data.items);
        setNextCursor(data.nextCursor);
        if (data.categories) setCategories(data.categories);
        if (data.baseCurrency) setBaseCurrency(data.baseCurrency);
      } catch { if (!cancelled) setError("Network error. Please check your connection."); }
      finally { if (!cancelled) { setLoading(false); setLoadingMore(false); } }
    })();
    return () => { cancelled = true; };
  }, [month, startDate, endDate, categoryId, currency, frequency, buildQueryString]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const handleResetFilters = () => {
    setMonth("");
    setStartDate("");
    setEndDate("");
    setCategoryId("");
    setCurrency("");
    setFrequency("");
  };

  return (
    <div className="expense-list">
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Month</label>
          <input 
            type="month" 
            value={month} 
            onChange={e => { setMonth(e.target.value); setStartDate(""); setEndDate(""); }}
            className="input-field py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => { setStartDate(e.target.value); setMonth(""); }}
            className="input-field py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => { setEndDate(e.target.value); setMonth(""); }}
            className="input-field py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Category</label>
          <select 
            value={categoryId} 
            onChange={e => setCategoryId(e.target.value)}
            className="input-field py-1.5 text-sm"
          >
            <option value="">All Categories</option>
            {categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Currency</label>
          <select 
            value={currency} 
            onChange={e => setCurrency(e.target.value)}
            className="input-field py-1.5 text-sm"
          >
            <option value="">All</option>
            {Object.keys(CURRENCIES).map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Frequency</label>
          <select 
            value={frequency} 
            onChange={e => setFrequency(e.target.value)}
            className="input-field py-1.5 text-sm"
          >
            <option value="">All</option>
            {Object.entries(FREQUENCY_LABELS).map(([val, label]) => (
              <option key={val} value={val}>{label}</option>
            ))}
          </select>
        </div>
        {(month || startDate || endDate || categoryId || currency || frequency) && (
          <button onClick={handleResetFilters} className="btn-secondary py-1.5 text-sm h-[34px]">
            Reset Filters
          </button>
        )}
      </div>

      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {loading && (
        <div className="loading-state">
          <Loader2 size={24} className="spin" />
          <p>Loading expenses…</p>
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="panel empty-state">
          <span className="empty-icon">
            <ReceiptText size={28} />
          </span>
          <h3>No expenses yet</h3>
          <p>Start by recording your first expense.</p>
          <Link className="button primary" href="/expenses/new">
            Record an expense
          </Link>
        </div>
      )}

      {!loading && items.length > 0 && (
        <>
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Title</th>
                  <th>Category</th>
                  <th className="text-right">Amount</th>
                  <th>Frequency</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className={item.archivedAt ? "archived-row" : ""}>
                    <td className="date-cell">{item.date}</td>
                    <td>
                      <strong>{item.title}</strong>
                    </td>
                    <td>
                      <span className="badge neutral">{categoryName(item.categoryId)}</span>
                    </td>
                    <td className="text-right amount-cell">
                      <strong>{formatMoney(item.baseAmountMinor, item.baseCurrency)}</strong>
                      {item.currency !== item.baseCurrency && (
                        <small className="original-amount">
                          {CURRENCIES[item.currency]?.symbol}
                          {(item.originalAmountMinor / 100).toFixed(2)}
                        </small>
                      )}
                    </td>
                    <td>
                      <span className="badge neutral">{FREQUENCY_LABELS[item.frequency] ?? item.frequency}</span>
                    </td>
                    <td>
                      <Link href={`/expenses/${item.id}`} className="icon-button" aria-label={`View ${item.title}`}>
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {nextCursor && (
            <div style={{ textAlign: "center", marginTop: "var(--space-4)" }}>
              <button
                className="button secondary"
                onClick={() => fetchExpenses(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={16} className="spin" /> Loading…
                  </>
                ) : (
                  "Load more"
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
