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
    <div className="space-y-6">
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow w-full sm:w-auto"
            aria-label="Filter by period"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "pending" | "paid")}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-shadow w-full sm:w-auto"
          >
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        <button
          onClick={() => fetchSalaries()}
          className="p-2 text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors ml-auto sm:ml-0 shrink-0"
          title="Refresh list"
        >
          <RefreshCw className={`w-5 h-5 ${loading && !loadingMore ? "animate-spin" : ""}`} />
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      )}

      {loading && !loadingMore && !error ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      ) : items.length === 0 && !error ? (
        <div className="text-center py-12 bg-white rounded-xl border border-gray-100 border-dashed">
          <div className="w-12 h-12 mx-auto bg-gray-50 rounded-full flex items-center justify-center mb-3">
            <Users className="w-6 h-6 text-gray-400" />
          </div>
          <h3 className="text-sm font-medium text-gray-900">No salaries found</h3>
          <p className="text-sm text-gray-500 mt-1">Try adjusting your filters or record a new salary.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <ul className="divide-y divide-gray-50">
            {items.map((item) => {
              const cDef = CURRENCIES[item.currency];
              const isArchived = !!item.archivedAt;
              const isPending = item.status === "pending";

              return (
                <li key={item.id} className="relative hover:bg-gray-50/50 transition-colors group">
                  <Link href={`/salaries/${item.id}`} className="block px-6 py-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className={`text-sm font-medium truncate ${isArchived ? "text-gray-400 line-through" : "text-gray-900"}`}>
                            {item.workerName || "Unknown Worker"}
                          </p>
                          {isPending && !isArchived && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                              Pending
                            </span>
                          )}
                          {isArchived && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                              Archived
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">
                            {item.period}
                          </span>
                          {!isPending && item.paymentDate && (
                            <span className="text-xs text-gray-400">&bull; Paid {item.paymentDate}</span>
                          )}
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <div className={`text-sm font-semibold ${isArchived ? "text-gray-400" : "text-gray-900"}`}>
                          {cDef?.symbol}{formatMoney(item.originalAmountMinor, item.currency)}
                        </div>
                        {item.currency !== item.baseCurrency && (
                          <div className="text-xs text-gray-500 mt-0.5">
                            {CURRENCIES[item.baseCurrency]?.symbol}{formatMoney(item.baseAmountMinor, item.baseCurrency)} base
                          </div>
                        )}
                      </div>

                      <div className="shrink-0 text-gray-400 group-hover:text-indigo-600 transition-colors">
                        <ArrowUpRight className="w-5 h-5" />
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>

          {nextCursor && (
            <div className="p-4 border-t border-gray-50 bg-gray-50/30 text-center">
              <button
                onClick={() => fetchSalaries(nextCursor)}
                disabled={loadingMore}
                className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50 transition-colors"
              >
                {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                {loadingMore ? "Loading..." : "Load More"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
