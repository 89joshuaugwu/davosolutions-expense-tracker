"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, Loader2, Users, RefreshCw } from "lucide-react";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/domain/money";

interface SalaryItem {
  id: string;
  workerName?: string;
  period: string;
  originalAmountMinor: number;
  currency: CurrencyCode;
  baseAmountMinor: number;
  baseCurrency: CurrencyCode;
  status: "pending" | "paid";
  paymentDate?: string;
  createdBy: string;
  createdAt: string;
  archivedAt: string | null;
}

interface Props {
  initialPeriod?: string;
}

export function SalaryList({ initialPeriod }: Props) {
  const [items, setItems] = useState<SalaryItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [period, setPeriod] = useState(initialPeriod ?? new Date().toISOString().slice(0, 7));
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "paid">("all");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fetchSalaries = useCallback(
    async (cursor?: string) => {
      const isLoadingMore = !!cursor;
      if (isLoadingMore) setLoadingMore(true);
      else setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (period) params.set("period", period);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (cursor) params.set("startAfter", cursor);

        const response = await fetch(`/api/salaries?${params.toString()}`);
        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to load salaries");
          return;
        }

        if (isLoadingMore) {
          setItems((prev) => [...prev, ...data.salaries]);
        } else {
          setItems(data.salaries || []);
        }
        setNextCursor(data.nextCursor || null);
        // Assuming base currency from first item for simplicity here if needed, or fetched globally
      } catch {
        setError("A network error occurred.");
      } finally {
        if (isLoadingMore) setLoadingMore(false);
        else setLoading(false);
      }
    },
    [period, statusFilter],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSalaries();
  }, [fetchSalaries]);

  return (
    <div className="salary-list">
      <div className="list-controls">
        <div className="form-group" style={{ maxWidth: 200, marginBottom: 0 }}>
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Filter by period"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "paid")}
          className="filter-select"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
        </select>
        <button
          onClick={() => fetchSalaries()}
          className="button secondary icon-button"
          title="Refresh list"
        >
          <RefreshCw size={16} className={loading && !loadingMore ? "spin" : ""} />
        </button>
      </div>

      {error && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} /> {error}
        </p>
      )}

      {loading && !loadingMore && !error ? (
        <div className="loading-state">
          <Loader2 size={24} className="spin" />
          <p>Loading salaries…</p>
        </div>
      ) : items.length === 0 && !error ? (
        <div className="panel empty-state">
          <span className="empty-icon">
            <Users size={28} />
          </span>
          <h3>No salaries found</h3>
          <p>Try adjusting your filters or record a new salary.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Worker</th>
                <th>Period</th>
                <th className="text-right">Amount</th>
                <th>Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const cDef = CURRENCIES[item.currency];
                const isArchived = !!item.archivedAt;
                const isPending = item.status === "pending";

                return (
                  <tr key={item.id} className={isArchived ? "archived-row" : ""}>
                    <td>
                      <strong>{item.workerName || "Unknown Worker"}</strong>
                    </td>
                    <td className="date-cell">{item.period}</td>
                    <td className="text-right amount-cell">
                      <strong>{formatMoney(item.originalAmountMinor, item.currency)}</strong>
                      {item.currency !== item.baseCurrency && (
                        <small className="original-amount">
                          {CURRENCIES[item.baseCurrency]?.symbol}{formatMoney(item.baseAmountMinor, item.baseCurrency)} base
                        </small>
                      )}
                    </td>
                    <td>
                      {isArchived ? (
                        <span className="badge neutral">Archived</span>
                      ) : isPending ? (
                        <span className="badge warning">Pending</span>
                      ) : (
                        <span className="badge success">Paid {item.paymentDate}</span>
                      )}
                    </td>
                    <td>
                      <Link href={`/salaries/${item.id}`} className="icon-button" aria-label={`View ${item.workerName}`}>
                        <ArrowUpRight size={16} />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {nextCursor && (
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button
                className="button secondary"
                onClick={() => fetchSalaries(nextCursor)}
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
        </div>
      )}
    </div>
  );
}
