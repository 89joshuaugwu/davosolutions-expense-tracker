"use client";

import { useState } from "react";
import { AlertCircle, ArrowRight, Download, FileBarChart2, Loader2, RefreshCw, WalletCards } from "lucide-react";
import { currentReportingMonth } from "@/domain/dates";
import { formatMoney } from "@/domain/money";

type Summary = {
  baseCurrency: string;
  openingFundMinor: number;
  totalRevenueMinor: number;
  totalExpensesMinor: number;
  netProfitMinor: number;
  remainingOpeningFundMinor: number;
  closingBalanceMinor: number;
  profitMarginPercent: number | null;
};

type Analytics = {
  summary: Summary;
  hasFund: boolean;
  categoryBreakdown: Array<{ categoryId: string; totalMinor: number }>;
  revenueBreakdown: Array<{ sourceId: string; totalMinor: number }>;
};

type DashboardResponse = { analytics: Analytics | null; error?: string };

type ReportCard = {
  title: string;
  description: string;
  href: (month: string) => string;
  detailHref: string;
};

const reports: ReportCard[] = [
  { title: "Monthly profit & loss", description: "Revenue, expenses, profit, and closing balance for one month.", href: (month) => `/api/export/profit-loss?month=${month}`, detailHref: "/profit-loss" },
  { title: "Fund utilization", description: "Opening fund, spending, remaining funds, and closing balance.", href: (month) => `/api/export/profit-loss?month=${month}`, detailHref: "/monthly-funds" },
  { title: "Expenses by category", description: "General expense rows for the selected reporting month.", href: (month) => `/api/export/expenses?month=${month}`, detailHref: "/expenses" },
  { title: "Salary register", description: "Salary status, period, payment date, and recorded values.", href: (month) => `/api/export/salaries?period=${month}`, detailHref: "/salaries" },
  { title: "Transportation", description: "Morning, evening, extra, and total transport amounts.", href: (month) => `/api/export/transport?month=${month}`, detailHref: "/transport" },
  { title: "Bills & due dates", description: "Current bill definitions, schedules, due dates, and status.", href: () => "/api/export/bills", detailHref: "/bills" },
  { title: "Revenue by source", description: "Revenue rows and source attribution for the selected month.", href: (month) => `/api/export/revenue?month=${month}`, detailHref: "/revenue" },
  { title: "Currency conversion details", description: "Historical original amounts, applied rates, and base values.", href: (month) => `/api/export/fx?month=${month}`, detailHref: "/settings" },
  { title: "Audit trail", description: "Management and financial activity recorded during the selected month.", href: (month) => `/api/export/audit?month=${month}`, detailHref: "/audit-log" },
];

function currency(value: number, baseCurrency: string): string {
  return formatMoney(value, baseCurrency as Parameters<typeof formatMoney>[1]);
}

export function ReportsCenter({ initialMonth, initialAnalytics }: { initialMonth: string; initialAnalytics: Analytics }) {
  const [month, setMonth] = useState(initialMonth);
  const [analytics, setAnalytics] = useState<Analytics | null>(initialAnalytics);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function load(nextMonth = month) {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/dashboard?month=${encodeURIComponent(nextMonth)}`, { cache: "no-store" });
      const payload = (await response.json()) as DashboardResponse;
      if (!response.ok || !payload.analytics) {
        throw new Error(payload.error || "Unable to load the reporting summary.");
      }
      setAnalytics(payload.analytics);
    } catch (cause) {
      setAnalytics(null);
      setError(cause instanceof Error ? cause.message : "Unable to load the reporting summary.");
    } finally {
      setLoading(false);
    }
  }

  function changeMonth(nextMonth: string) {
    setMonth(nextMonth);
    void load(nextMonth);
  }

  const summary = analytics?.summary;

  return (
    <div className="reports-page">
      <header className="page-heading reports-heading">
        <div>
          <p className="eyebrow">FINANCE</p>
          <h1>Reports</h1>
          <p>Review a consistent reporting month, then export the records you need.</p>
        </div>
        <div className="reports-toolbar">
          <label className="reports-month-field">
            <span className="sr-only">Reporting month</span>
            <input type="month" value={month} max={currentReportingMonth()} onChange={(event) => changeMonth(event.target.value)} />
          </label>
          <button className="icon-button reports-refresh" type="button" onClick={() => void load()} disabled={loading} aria-label="Refresh reports" title="Refresh reports">
            <RefreshCw size={16} className={loading ? "spin" : undefined} />
          </button>
        </div>
      </header>

      {error && <p className="notice error" role="alert"><AlertCircle size={18} /> {error}</p>}

      {loading && !summary ? <div className="loading-state"><Loader2 size={24} className="spin" /><p>Loading reporting summary…</p></div> : null}

      {summary ? <section className="reports-summary" aria-label={`Financial summary for ${month}`}>
        <div className="reports-summary-intro">
          <span className="reports-summary-icon"><WalletCards size={19} /></span>
          <div><strong>{month}</strong><span>{analytics?.hasFund ? "Opening fund recorded" : "No opening fund recorded"}</span></div>
        </div>
        <div className="reports-metric-grid">
          <div><span>Opening fund</span><strong>{currency(summary.openingFundMinor, summary.baseCurrency)}</strong></div>
          <div><span>Revenue</span><strong className="positive-value">{currency(summary.totalRevenueMinor, summary.baseCurrency)}</strong></div>
          <div><span>Expenses</span><strong>{currency(summary.totalExpensesMinor, summary.baseCurrency)}</strong></div>
          <div><span>Net profit / loss</span><strong className={summary.netProfitMinor >= 0 ? "positive-value" : "negative-value"}>{currency(summary.netProfitMinor, summary.baseCurrency)}</strong></div>
          <div><span>Closing balance</span><strong>{currency(summary.closingBalanceMinor, summary.baseCurrency)}</strong></div>
        </div>
      </section> : null}

      <section className="reports-catalog" aria-labelledby="reports-catalog-title">
        <div className="reports-section-heading"><div><p className="eyebrow">EXPORTS</p><h2 id="reports-catalog-title">Report library</h2></div><p>CSV files preserve the selected period where the underlying record supports it.</p></div>
        <div className="reports-card-grid">
          {reports.map((report) => <article className="panel report-card" key={report.title}>
            <span className="report-card-icon"><FileBarChart2 size={18} /></span>
            <h3>{report.title}</h3>
            <p>{report.description}</p>
            <div className="report-card-actions">
              <a className="button primary" href={report.href(month)}><Download size={15} /> Download CSV</a>
              <a className="text-link" href={report.detailHref}>Open records <ArrowRight size={14} /></a>
            </div>
          </article>)}
        </div>
      </section>

      {summary ? <section className="reports-breakdown-grid" aria-label="Selected month breakdowns">
        <article className="panel reports-breakdown"><h2>Expense categories</h2>{analytics?.categoryBreakdown.length ? <ul>{analytics.categoryBreakdown.slice(0, 6).map((item) => <li key={item.categoryId}><span>{item.categoryId}</span><strong>{currency(item.totalMinor, summary.baseCurrency)}</strong></li>)}</ul> : <p className="muted">No expense categories were recorded for this month.</p>}</article>
        <article className="panel reports-breakdown"><h2>Revenue sources</h2>{analytics?.revenueBreakdown.length ? <ul>{analytics.revenueBreakdown.slice(0, 6).map((item) => <li key={item.sourceId}><span>{item.sourceId}</span><strong>{currency(item.totalMinor, summary.baseCurrency)}</strong></li>)}</ul> : <p className="muted">No revenue sources were recorded for this month.</p>}</article>
      </section> : null}
    </div>
  );
}
