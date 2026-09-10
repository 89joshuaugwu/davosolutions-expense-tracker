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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monthly Funds</h1>
          <p className="text-sm text-gray-500 mt-1">Manage opening cash allocations for reporting months.</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/monthly-funds/new"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Allocation
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start">
          <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-500">Loading funds...</div>
      ) : funds.length === 0 && !error ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500">No monthly funds have been allocated yet.</p>
        </div>
      ) : funds.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Month</th>
                <th className="px-6 py-4 font-semibold">Source / Ref</th>
                <th className="px-6 py-4 font-semibold text-right">Original Amount</th>
                <th className="px-6 py-4 font-semibold text-right">Base Amount</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {funds.map((fund) => {
                return (
                  <tr key={fund.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 font-medium text-gray-900">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        {fund.month}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-gray-500">{fund.source || "—"}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatMoney(fund.originalAmountMinor, fund.currency as any)}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-600">
                      {fund.currency !== fund.baseCurrency 
                        ? formatMoney(fund.baseAmountMinor, fund.baseCurrency as any)
                        : "—"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/monthly-funds/${fund.id}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
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
    </div>
  );
}
