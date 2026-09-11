"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { TransportListItem } from "@/lib/server/repositories/transport";
import { formatMoney } from "@/domain/money";
import { AlertCircle, ChevronLeft, ChevronRight, Plus, Download } from "lucide-react";
import { currentReportingMonth } from "@/domain/dates";

export function TransportList() {
  const [logs, setLogs] = useState<TransportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to current month YYYY-MM
  const [currentMonth, setCurrentMonth] = useState(() => currentReportingMonth());

  const fetchLogs = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/transport?month=${month}`);
      if (!res.ok) throw new Error("Failed to load transport logs");
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs(currentMonth);
  }, [currentMonth, fetchLogs]);

  const handlePrevMonth = () => {
    setCurrentMonth((prev) => {
      let [year, month] = prev.split("-").map(Number);
      month -= 1;
      if (month < 1) {
        month = 12;
        year -= 1;
      }
      return `${year}-${String(month).padStart(2, "0")}`;
    });
  };
  const handleNextMonth = () => {
    setCurrentMonth((prev) => {
      let [year, month] = prev.split("-").map(Number);
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
      return `${year}-${String(month).padStart(2, "0")}`;
    });
  };

  const getMonthName = (yyyy_mm: string) => {
    const [year, month] = yyyy_mm.split("-").map(Number);
    const date = new Date(year, month - 1);
    return new Intl.DateTimeFormat("en-US", { month: "short", year: "numeric" }).format(date);
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Transport Register</h1>
          <p>Manage transport expenses.</p>
        </div>
        <div className="heading-actions">
          <div className="month-control">
            <button
              onClick={handlePrevMonth}
              className="icon-button"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ fontSize: 11, fontWeight: 500 }}>
              {getMonthName(currentMonth)}
            </span>
            <button
              onClick={handleNextMonth}
              className="icon-button"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          <Link className="button primary" href="/transport/new">
            <Plus size={16} /> Log Transport
          </Link>
          <a 
            href={`/api/export/transport?month=${currentMonth}`}
            className="button secondary"
            target="_blank"
            rel="noopener noreferrer"
            title="Export to CSV"
          >
            <Download size={16} /> Export
          </a>
        </div>
      </div>

      {error && (
        <div className="form-error">
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="panel empty-state">
          <h3>No transport logs found for this month.</h3>
        </div>
      ) : (
        <div className="panel table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Category</th>
                <th className="text-right">Morning</th>
                <th className="text-right">Evening</th>
                <th className="text-right">Extra</th>
                <th className="text-right">Total</th>
                <th className="text-center">Status</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className={log.archivedAt ? "archived-row" : ""}>
                  <td className="date-cell">{log.date}</td>
                  <td>{log.categoryId}</td>
                  <td className="text-right amount-cell">
                    {log.morningAmountMinor > 0 ? formatMoney(log.morningAmountMinor, log.currency) : "-"}
                  </td>
                  <td className="text-right amount-cell">
                    {log.eveningAmountMinor > 0 ? formatMoney(log.eveningAmountMinor, log.currency) : "-"}
                  </td>
                  <td className="text-right amount-cell">
                    {log.extraAmountMinor > 0 ? formatMoney(log.extraAmountMinor, log.currency) : "-"}
                  </td>
                  <td className="text-right amount-cell">
                    <strong>{formatMoney(log.originalAmountMinor, log.currency)}</strong>
                  </td>
                  <td className="text-center">
                    {log.archivedAt ? (
                      <span className="badge neutral">Archived</span>
                    ) : (
                      <span className="badge success">Active</span>
                    )}
                  </td>
                  <td>
                    <Link href={`/transport/${log.id}`} className="text-link">
                      View
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
