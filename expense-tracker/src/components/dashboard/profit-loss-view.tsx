"use client";

import { useState, useEffect, useCallback } from "react";
import { AlertCircle, ArrowDown, ArrowUp, Loader2, RefreshCw, Download } from "lucide-react";
import { formatMoney } from "@/domain/money";
import { currentReportingMonth } from "@/domain/dates";

export function ProfitLossView() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [month, setMonth] = useState(() => currentReportingMonth());

  const fetchDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/dashboard?month=${month}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error || "Failed to load P&L data");
      } else {
        setData(json);
      }
    } catch (e) {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const analytics = data?.analytics;
  const summary = analytics?.summary;

  return (
    <div className="profit-loss-container">
      <div className="page-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Profit & Loss</h1>
          <p>Detailed financial breakdown for the selected period.</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <input 
              type="month" 
              value={month} 
              onChange={e => setMonth(e.target.value)} 
              aria-label="Reporting Month"
            />
          </div>
          <button
            onClick={() => fetchDashboard()}
            className="icon-button"
            style={{ border: '1px solid var(--line)', background: 'white', width: '38px', height: '38px' }}
            title="Refresh data"
          >
            <RefreshCw size={16} className={loading ? "spin" : ""} />
          </button>
          {analytics && (
            <a 
              href={`/api/export/profit-loss?month=${month}`}
              className="button secondary"
              target="_blank"
              rel="noopener noreferrer"
              title="Export P&L to CSV"
            >
              <Download size={16} /> Export
            </a>
          )}
        </div>
      </div>

      {error && (
        <p className="notice error" role="alert">
          <AlertCircle size={18} /> {error}
        </p>
      )}

      {loading && !data && (
        <div className="loading-state">
          <Loader2 size={24} className="spin" />
          <p>Loading Profit & Loss report...</p>
        </div>
      )}

      {data && !analytics && (
        <div className="panel empty-state">
          <h3>Access Denied</h3>
          <p>You do not have permission to view operational totals and P&L statements.</p>
        </div>
      )}

      {data && analytics && summary && (
        <div className="panel" style={{ padding: '0', overflow: 'hidden' }}>
          <table className="data-table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '60%' }}>Account Category</th>
                <th className="text-right">Total Amount</th>
              </tr>
            </thead>
            <tbody>
              {/* REVENUE SECTION */}
              <tr style={{ background: 'var(--surface)' }}>
                <td colSpan={2}>
                  <strong>Income (Revenue)</strong>
                </td>
              </tr>
              {analytics.revenueBreakdown.length > 0 ? (
                analytics.revenueBreakdown.map((item: any) => (
                  <tr key={item.sourceId}>
                    <td style={{ paddingLeft: '2rem' }}>{item.sourceId}</td>
                    <td className="text-right" style={{ color: 'var(--success)' }}>
                      {formatMoney(item.totalMinor, summary.baseCurrency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ paddingLeft: '2rem', color: 'var(--text-secondary)' }} colSpan={2}>No income recorded</td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid var(--line)', background: 'var(--bg)' }}>
                <td><strong>Total Income</strong></td>
                <td className="text-right">
                  <strong>{formatMoney(summary.totalRevenueMinor, summary.baseCurrency)}</strong>
                </td>
              </tr>

              {/* SPACING */}
              <tr><td colSpan={2} style={{ height: '16px', padding: 0 }}></td></tr>

              {/* EXPENSE SECTION */}
              <tr style={{ background: 'var(--surface)' }}>
                <td colSpan={2}>
                  <strong>Operating Expenses</strong>
                </td>
              </tr>
              {analytics.categoryBreakdown.length > 0 ? (
                analytics.categoryBreakdown.map((item: any) => (
                  <tr key={item.categoryId}>
                    <td style={{ paddingLeft: '2rem' }}>{item.categoryId}</td>
                    <td className="text-right" style={{ color: 'var(--error)' }}>
                      {formatMoney(item.totalMinor, summary.baseCurrency)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td style={{ paddingLeft: '2rem', color: 'var(--text-secondary)' }} colSpan={2}>No expenses recorded</td>
                </tr>
              )}
              <tr style={{ borderTop: '2px solid var(--line)', background: 'var(--bg)' }}>
                <td><strong>Total Expenses</strong></td>
                <td className="text-right">
                  <strong>{formatMoney(summary.totalExpensesMinor, summary.baseCurrency)}</strong>
                </td>
              </tr>

              {/* SPACING */}
              <tr><td colSpan={2} style={{ height: '16px', padding: 0 }}></td></tr>
              
              {/* NET PROFIT */}
              <tr style={{ borderTop: '2px solid var(--line)', background: 'var(--surface)' }}>
                <td style={{ fontSize: '1.1rem' }}><strong>Net Profit / (Loss)</strong></td>
                <td className="text-right" style={{ fontSize: '1.1rem' }}>
                  <strong style={{ color: summary.netProfitMinor >= 0 ? 'var(--success)' : 'var(--error)' }}>
                    {formatMoney(summary.netProfitMinor, summary.baseCurrency)}
                  </strong>
                </td>
              </tr>
              <tr style={{ background: 'var(--surface)' }}>
                <td style={{ color: 'var(--text-secondary)' }}>Profit Margin</td>
                <td className="text-right" style={{ color: 'var(--text-secondary)' }}>
                  {summary.profitMarginPercent !== null ? `${summary.profitMarginPercent}%` : 'N/A'}
                </td>
              </tr>

            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
