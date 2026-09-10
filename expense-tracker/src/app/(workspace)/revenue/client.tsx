"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { RevenueSource } from "@/domain/models";
import type { CurrencyCode } from "@/domain/money";

interface RevenueListItem {
  id: string;
  description: string;
  originalAmountMinor: number;
  currency: CurrencyCode;
  baseAmountMinor: number;
  baseCurrency: CurrencyCode;
  sourceId: string;
  date: string;
  createdBy: string;
  archivedAt: string | null;
}

export function RevenueClient() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [items, setItems] = useState<RevenueListItem[]>([]);
  const [sources, setSources] = useState<RevenueSource[]>([]);
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>("NGN");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filters state
  const [startDate, setStartDate] = useState(searchParams.get("startDate") || "");
  const [endDate, setEndDate] = useState(searchParams.get("endDate") || "");
  const [sourceId, setSourceId] = useState(searchParams.get("sourceId") || "");
  const [currency, setCurrency] = useState(searchParams.get("currency") || "");

  const buildQueryString = useCallback((cursor?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    if (sourceId) params.set("sourceId", sourceId);
    if (currency) params.set("currency", currency);
    if (cursor) params.set("cursor", cursor);
    return params.toString();
  }, [startDate, endDate, sourceId, currency]);

  const loadData = useCallback(async (cursor?: string) => {
    try {
      if (cursor) setLoadingMore(true);
      else setLoading(true);
      setError("");

      const qs = buildQueryString(cursor);
      const res = await fetch(`/api/revenue?${qs}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to load revenue");
      }
      
      const data = await res.json();
      
      if (cursor) {
        setItems(prev => [...prev, ...data.items]);
      } else {
        setItems(data.items);
      }
      
      setSources(data.sources || []);
      setBaseCurrency(data.baseCurrency || "NGN");
      setNextCursor(data.nextCursor);

      // Update URL to reflect current filters
      if (!cursor) {
        const url = qs ? `/revenue?${qs}` : "/revenue";
        router.replace(url, { scroll: false });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [buildQueryString, router]);

  useEffect(() => {
    loadData();
  }, [startDate, endDate, sourceId, currency, loadData]); // Reload when filters change

  const formatMoney = (minorUnits: number, cur: CurrencyCode) => {
    const val = minorUnits / 100;
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: cur,
    }).format(val);
  };

  const getSourceName = (id: string) => {
    const s = sources.find(s => s.id === id);
    return s ? s.name : "Unknown Source";
  };

  const handleResetFilters = () => {
    setStartDate("");
    setEndDate("");
    setSourceId("");
    setCurrency("");
  };

  return (
    <div className="layout-panel">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Revenue</h1>
          <p className="text-sm text-gray-500 mt-1">Manage and track your company's income.</p>
        </div>
        <div className="flex gap-2">
          <Link href="/revenue/sources" className="btn-secondary">
            Manage Sources
          </Link>
          <Link href="/revenue/new" className="btn-primary">
            Record Revenue
          </Link>
        </div>
      </div>

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm mb-6 flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Start Date</label>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            className="input-field py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">End Date</label>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            className="input-field py-1.5 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Source</label>
          <select 
            value={sourceId} 
            onChange={e => setSourceId(e.target.value)}
            className="input-field py-1.5 text-sm"
          >
            <option value="">All Sources</option>
            {sources.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
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
            <option value="">All Currencies</option>
            <option value="NGN">NGN</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
          </select>
        </div>
        {(startDate || endDate || sourceId || currency) && (
          <button onClick={handleResetFilters} className="btn-secondary py-1.5 text-sm h-[34px]">
            Reset Filters
          </button>
        )}
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading && items.length === 0 ? (
          <div className="p-8 text-center text-gray-500">Loading revenue records...</div>
        ) : items.length === 0 ? (
          <div className="p-12 text-center">
            <h3 className="text-lg font-medium text-gray-900 mb-2">No revenue found</h3>
            <p className="text-gray-500 mb-6">There are no revenue records matching your criteria.</p>
            <Link href="/revenue/new" className="btn-primary">
              Record Revenue
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                  <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Original Amount</th>
                  <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Converted ({baseCurrency})</th>
                  <th className="p-4 text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 text-sm text-gray-900 whitespace-nowrap">{item.date}</td>
                    <td className="p-4 text-sm text-gray-900">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        {getSourceName(item.sourceId)}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-gray-500 max-w-xs truncate">{item.description || "—"}</td>
                    <td className="p-4 text-sm text-gray-900 font-medium">
                      {formatMoney(item.originalAmountMinor, item.currency)}
                    </td>
                    <td className="p-4 text-sm text-gray-500">
                      {item.currency !== item.baseCurrency ? formatMoney(item.baseAmountMinor, item.baseCurrency) : "—"}
                    </td>
                    <td className="p-4 text-sm">
                      <Link href={`/revenue/${item.id}`} className="text-blue-600 hover:text-blue-800 font-medium">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {nextCursor && (
        <div className="mt-6 text-center">
          <button 
            onClick={() => loadData(nextCursor)} 
            disabled={loadingMore}
            className="btn-secondary"
          >
            {loadingMore ? "Loading..." : "Load More"}
          </button>
        </div>
      )}
    </div>
  );
}
