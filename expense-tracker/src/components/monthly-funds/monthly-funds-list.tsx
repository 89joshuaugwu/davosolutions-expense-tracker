"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatMoney } from "@/domain/money";
import { AlertCircle, Calendar, Plus } from "lucide-react";

interface MonthlyFundListItem {
  id: string; // which is the month YYYY-MM
  month: string;
  source: string;
  originalAmountMinor: number;
  currency: string;
  baseAmountMinor: number;
  baseCurrency: string;
  createdAt: string;
}

export function MonthlyFundsList() {
  const [funds, setFunds] = useState<MonthlyFundListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFunds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/monthly-funds");
      if (!res.ok) {
        if (res.status === 403) throw new Error("Access denied. Super Admin only.");
        throw new Error("Failed to load monthly funds");
      }
      const data = await res.json();
      setFunds(data.funds || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFunds();
  }, [fetchFunds]);

  return (
    <>
      <div className="page-heading">
        <div>
          <p className="eyebrow">WORKSPACE</p>
          <h1>Monthly Funds</h1>
          <p>Manage opening cash allocations for reporting months.</p>
        </div>
        <div className="heading-actions">
          <Link className="button primary" href="/monthly-funds/new">
            <Plus size={16} /> New Allocation
          </Link>
        </div>
      </div>

      {error && (
        <div className="form-error">
          <AlertCircle size={16} />
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <div className="loading-state">Loading funds...</div>
      ) : funds.length === 0 && !error ? (
        <div className="panel empty-state">
          <h3>No monthly funds have been allocated yet.</h3>
        </div>
      ) : funds.length > 0 ? (
        <div className="panel table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th>Source / Ref</th>
                <th className="text-right">Original Amount</th>
                <th className="text-right">Base Amount</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {funds.map((fund) => {
                return (
                  <tr key={fund.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 500 }}>
                        <Calendar size={14} style={{ color: "var(--muted)" }} />
                        {fund.month}
                      </div>
                    </td>
                    <td style={{ color: "var(--muted)" }}>{fund.source || "—"}</td>
                    <td className="text-right amount-cell">
                      <strong>{formatMoney(fund.originalAmountMinor, fund.currency as any)}</strong>
                    </td>
                    <td className="text-right amount-cell">
                      {fund.currency !== fund.baseCurrency 
                        ? formatMoney(fund.baseAmountMinor, fund.baseCurrency as any)
                        : "—"}
                    </td>
                    <td>
                      <Link href={`/monthly-funds/${fund.id}`} className="text-link">
                        Reconciliation
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
