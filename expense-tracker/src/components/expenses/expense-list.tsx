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

  const fetchExpenses = useCallback(
    async (cursor?: string) => {
      const isLoadingMore = !!cursor;
      if (isLoadingMore) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (month) params.set("month", month);
        if (cursor) params.set("cursor", cursor);

        const response = await fetch(`/api/expenses?${params.toString()}`);
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
    void fetchExpenses();
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [fetchExpenses]);

  const categoryName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  return (
    <div className="expense-list">
      <div className="list-controls">
        <div className="form-group" style={{ maxWidth: 200 }}>
          <label htmlFor="expense-month" className="sr-only">
            Month
          </label>
          <input
            id="expense-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          />
        </div>
        <button
          className="button secondary icon-button"
          onClick={() => fetchExpenses()}
          disabled={loading}
          aria-label="Refresh expenses"
        >
          <RefreshCw size={16} className={loading ? "spin" : ""} />
        </button>
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
