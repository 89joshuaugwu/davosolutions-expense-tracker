"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import type { TransportListItem } from "@/lib/server/repositories/transport";
import { formatMoney } from "@/domain/money";
import { AlertCircle, ChevronLeft, ChevronRight, Plus } from "lucide-react";

export function TransportList() {
  const [logs, setLogs] = useState<TransportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to current month YYYY-MM
  const [currentMonth, setCurrentMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

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
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Transport Register</h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border border-gray-200 rounded-lg shadow-sm p-1">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="text-sm font-semibold w-28 text-center text-gray-700">
              {getMonthName(currentMonth)}
            </span>
            <button
              onClick={handleNextMonth}
              className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <Link
            href="/transport/new"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Log Transport
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
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500">No transport logs found for this month.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-4 font-semibold">Date</th>
                  <th className="px-6 py-4 font-semibold">Category</th>
                  <th className="px-6 py-4 font-semibold text-right">Morning</th>
                  <th className="px-6 py-4 font-semibold text-right">Evening</th>
                  <th className="px-6 py-4 font-semibold text-right">Extra</th>
                  <th className="px-6 py-4 font-semibold text-right">Total</th>
                  <th className="px-6 py-4 font-semibold text-center">Status</th>
                  <th className="px-6 py-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {logs.map((log) => (
                  <tr key={log.id} className={log.archivedAt ? "opacity-60 bg-gray-50" : "hover:bg-gray-50/50 transition-colors"}>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-900">{log.date}</td>
                    <td className="px-6 py-4 text-gray-600 truncate max-w-[150px]">{log.categoryId}</td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {log.morningAmountMinor > 0 ? formatMoney(log.morningAmountMinor, log.currency) : "-"}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {log.eveningAmountMinor > 0 ? formatMoney(log.eveningAmountMinor, log.currency) : "-"}
                    </td>
                    <td className="px-6 py-4 text-right text-gray-500">
                      {log.extraAmountMinor > 0 ? formatMoney(log.extraAmountMinor, log.currency) : "-"}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatMoney(log.originalAmountMinor, log.currency)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {log.archivedAt ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Archived
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Active
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/transport/${log.id}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
