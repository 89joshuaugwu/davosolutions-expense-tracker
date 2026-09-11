"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Download } from "lucide-react";
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
    <div>
      <div className="page-heading">
        <div>
          <h1>Revenue</h1>
          <p>Manage and track your company's income.</p>
        </div>
        <div className="heading-actions">
          <Link href="/revenue/sources" className="button secondary">
            Manage Sources
          </Link>
          <Link href="/revenue/new" className="button primary">
            Record Revenue
          </Link>
        </div>
      </div>

      <div className="list-controls" style={{ flexWrap: 'wrap' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input 
            type="date" 
            value={startDate} 
            onChange={e => setStartDate(e.target.value)}
            aria-label="Start Date"
          />
        </div>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <input 
            type="date" 
            value={endDate} 
            onChange={e => setEndDate(e.target.value)}
            aria-label="End Date"
          />
        </div>
        <select 
          value={sourceId} 
          onChange={e => setSourceId(e.target.value)}
          className="filter-select"
        >
          <option value="">All Sources</option>
          {sources.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        <select 
          value={currency} 
          onChange={e => setCurrency(e.target.value)}
          className="filter-select"
        >
          <option value="">All Currencies</option>
          <option value="NGN">NGN</option>
          <option value="USD">USD</option>
          <option value="EUR">EUR</option>
          <option value="GBP">GBP</option>
        </select>
        {(startDate || endDate || sourceId || currency) && (
          <button onClick={handleResetFilters} className="button secondary">
            Reset Filters
          </button>
        )}
        <div style={{ flex: 1 }}></div>
        <a 
          href={`/api/export/revenue?startDate=${startDate}&endDate=${endDate}&sourceId=${sourceId}&currency=${currency}`}
          className="button secondary"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Download size={16} /> Export CSV
        </a>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      {loading && items.length === 0 ? (
        <div className="loading-state">
          <p>Loading revenue records…</p>
        </div>
      ) : items.length === 0 ? (
        <div className="panel empty-state">
          <h3>No revenue found</h3>
          <p>There are no revenue records matching your criteria.</p>
          <Link className="button primary" href="/revenue/new">
            Record Revenue
          </Link>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Source</th>
                <th>Description</th>
                <th className="text-right">Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className={item.archivedAt ? "archived-row" : ""}>
                  <td className="date-cell">{item.date}</td>
                  <td>
                    <span className="badge neutral">
                      {getSourceName(item.sourceId)}
                    </span>
                  </td>
                  <td>
                    <strong>{item.description || "—"}</strong>
                  </td>
                  <td className="text-right amount-cell">
                    <strong>{formatMoney(item.originalAmountMinor, item.currency)}</strong>
                    {item.currency !== item.baseCurrency && (
                      <small className="original-amount">
                        {formatMoney(item.baseAmountMinor, item.baseCurrency)} base
                      </small>
                    )}
                  </td>
                  <td>
                    <Link href={`/revenue/${item.id}`} className="icon-button" aria-label={`View revenue from ${item.date}`}>
                      →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {nextCursor && (
            <div style={{ textAlign: "center", marginTop: "16px" }}>
              <button
                className="button secondary"
                onClick={() => loadData(nextCursor)}
                disabled={loadingMore}
              >
                {loadingMore ? "Loading…" : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
