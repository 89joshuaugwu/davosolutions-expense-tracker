"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatMoney } from "@/domain/money";
import { AlertCircle, Calendar, Plus } from "lucide-react";

interface BillListItem {
  id: string;
  name: string;
  provider: string;
  amountMinor: number;
  currency: string;
  frequency: string;
  nextDueDate: string;
  status: "active" | "paused" | "completed";
}

export function BillList() {
  const [bills, setBills] = useState<BillListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"active" | "paused" | "completed">("active");

  const fetchBills = useCallback(async (status: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/bills?status=${status}`);
      if (!res.ok) throw new Error("Failed to load bills");
      const data = await res.json();
      setBills(data.bills || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBills(statusFilter);
  }, [statusFilter, fetchBills]);

  const formatDate = (dateStr: string) => {
    return new Intl.DateTimeFormat("en-US", {
      month: "short", day: "numeric", year: "numeric"
    }).format(new Date(dateStr));
  };

  const getStatusDisplay = (status: string) => {
    switch(status) {
      case "active": return <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">Active</span>;
      case "paused": return <span className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded text-xs font-medium">Paused</span>;
      case "completed": return <span className="bg-gray-100 text-gray-800 px-2 py-1 rounded text-xs font-medium">Completed</span>;
      default: return null;
    }
  };

  // Compute "due today" / "overdue" / "upcoming" locally
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900">Bills & Occurrences</h1>
        <div className="flex items-center gap-3">
          <select 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="border-gray-300 rounded-lg text-sm"
          >
            <option value="active">Active Bills</option>
            <option value="paused">Paused Bills</option>
            <option value="completed">Completed Bills</option>
          </select>
          <Link
            href="/bills/new"
            className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            New Bill
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
        <div className="text-center py-12 text-gray-500">Loading bills...</div>
      ) : bills.length === 0 ? (
        <div className="text-center py-12 bg-white border border-gray-200 rounded-xl">
          <p className="text-gray-500">No {statusFilter} bills found.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 border-b border-gray-200">
              <tr>
                <th className="px-6 py-4 font-semibold">Bill Name</th>
                <th className="px-6 py-4 font-semibold">Provider</th>
                <th className="px-6 py-4 font-semibold text-right">Amount</th>
                <th className="px-6 py-4 font-semibold">Frequency</th>
                <th className="px-6 py-4 font-semibold">Next Due Date</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {bills.map((bill) => {
                const isOverdue = bill.status === "active" && bill.nextDueDate < today;
                const isDueToday = bill.status === "active" && bill.nextDueDate === today;
                return (
                  <tr key={bill.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-gray-900">{bill.name}</td>
                    <td className="px-6 py-4 text-gray-500">{bill.provider}</td>
                    <td className="px-6 py-4 text-right font-medium text-gray-900">
                      {formatMoney(bill.amountMinor, bill.currency as any)}
                    </td>
                    <td className="px-6 py-4 text-gray-500 capitalize">{bill.frequency.replace("_", "-")}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className={`font-medium ${isOverdue ? 'text-red-600' : isDueToday ? 'text-orange-600' : 'text-gray-700'}`}>
                          {formatDate(bill.nextDueDate)}
                        </span>
                        {isOverdue && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Overdue</span>}
                        {isDueToday && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded">Due Today</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {getStatusDisplay(bill.status)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link href={`/bills/${bill.id}`} className="text-blue-600 hover:text-blue-800 font-medium hover:underline">
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
