"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "@/domain/money";
import type { FinancialSummary } from "@/domain/ledger";
import { AlertCircle, ArrowLeft, ArrowDown, ArrowUp, DollarSign, Wallet } from "lucide-react";

interface MonthlyFund {
  id: string;
  month: string;
  originalAmountMinor: number;
  currency: string;
  baseAmountMinor: number;
  baseCurrency: string;
}

export function MonthlyReconciliation({ month }: { month: string }) {
  const router = useRouter();
  const [data, setData] = useState<{ fund: MonthlyFund | null, summary: FinancialSummary } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`/api/monthly-funds/${month}/summary`);
      if (!res.ok) {
        if (res.status === 403) throw new Error("Access denied. Super Admin only.");
        throw new Error("Failed to load summary");
      }
      setData(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  if (loading) return <div className="p-8 text-center text-gray-500">Loading reconciliation...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-md m-4">{error}</div>;
  if (!data) return null;

  const { fund, summary } = data;
  const baseCurrency = summary.baseCurrency as any;

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Monthly Reconciliation: {month}</h1>
          <p className="text-sm text-gray-500">Overview of opening funds, revenue, and expenses in Base Currency ({baseCurrency}).</p>
        </div>
      </div>

      {!fund && (
        <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800">No Opening Fund Allocated</p>
            <p className="text-sm text-yellow-700 mt-1">
              There is no fund allocation recorded for {month}. The opening balance is treated as zero.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-gray-500 mb-2">
            <Wallet className="w-4 h-4" />
            <h3 className="text-sm font-medium">Opening Fund</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatMoney(summary.openingFundMinor, baseCurrency)}
          </p>
          {fund && fund.currency !== baseCurrency && (
            <p className="text-xs text-gray-500 mt-1">
              Original: {formatMoney(fund.originalAmountMinor, fund.currency as any)}
            </p>
          )}
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-green-600 mb-2">
            <ArrowDown className="w-4 h-4" />
            <h3 className="text-sm font-medium">Total Revenue</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatMoney(summary.totalRevenueMinor, baseCurrency)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-2 text-red-600 mb-2">
            <ArrowUp className="w-4 h-4" />
            <h3 className="text-sm font-medium">Total Expenses</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatMoney(summary.totalExpensesMinor, baseCurrency)}
          </p>
        </div>

        <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm border-t-4 border-t-blue-500">
          <div className="flex items-center gap-2 text-blue-700 mb-2">
            <DollarSign className="w-4 h-4" />
            <h3 className="text-sm font-medium">Closing Balance</h3>
          </div>
          <p className="text-2xl font-bold text-gray-900">
            {formatMoney(summary.closingBalanceMinor, baseCurrency)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Remaining Opening Fund</h3>
          <p className="text-3xl font-bold text-gray-900">
            {formatMoney(summary.remainingOpeningFundMinor, baseCurrency)}
          </p>
          <p className="text-sm text-gray-500 mt-2">
            (Opening Fund - Total Expenses)
          </p>
        </div>

        <div className="bg-gray-50 p-6 rounded-xl border border-gray-200">
          <h3 className="font-semibold text-gray-900 mb-4">Net Profit</h3>
          <div className="flex items-end gap-3">
            <p className={`text-3xl font-bold ${summary.netProfitMinor >= 0 ? "text-green-600" : "text-red-600"}`}>
              {formatMoney(summary.netProfitMinor, baseCurrency)}
            </p>
            {summary.profitMarginPercent !== null && (
              <span className="text-sm font-medium bg-white px-2 py-1 rounded border border-gray-200 shadow-sm mb-1">
                {summary.profitMarginPercent > 0 ? "+" : ""}{summary.profitMarginPercent}% Margin
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 mt-2">
            (Total Revenue - Total Expenses)
          </p>
        </div>
      </div>
    </div>
  );
}
