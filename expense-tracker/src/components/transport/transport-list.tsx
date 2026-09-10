"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { fetchWrapper } from "@/lib/client/api";
import type { TransportListItem } from "@/lib/server/repositories/transport";
import { formatMoney } from "@/domain/money";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, subMonths, addMonths } from "date-fns";

export function TransportList() {
  const [logs, setLogs] = useState<TransportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Default to current month
  const [currentMonth, setCurrentMonth] = useState(() => format(new Date(), "yyyy-MM"));

  const fetchLogs = useCallback(async (month: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchWrapper(`/api/transport?month=${month}`);
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
    setCurrentMonth((prev) => format(subMonths(new Date(`${prev}-01`), 1), "yyyy-MM"));
  };
  const handleNextMonth = () => {
    setCurrentMonth((prev) => format(addMonths(new Date(`${prev}-01`), 1), "yyyy-MM"));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Transport Register</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handlePrevMonth}>&larr;</Button>
          <span className="text-sm font-medium w-24 text-center">
            {format(new Date(`${currentMonth}-01`), "MMM yyyy")}
          </span>
          <Button variant="outline" size="sm" onClick={handleNextMonth}>&rarr;</Button>
          <Link href="/transport/new" className="ml-4">
            <Button size="sm">Log Transport</Button>
          </Link>
        </div>
      </div>

      {error && <div className="text-destructive text-sm">{error}</div>}

      {loading ? (
        <div className="text-sm text-muted-foreground">Loading...</div>
      ) : logs.length === 0 ? (
        <div className="text-sm text-muted-foreground border rounded-md p-8 text-center bg-muted/20">
          No transport logs found for this month.
        </div>
      ) : (
        <div className="border rounded-md overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted text-muted-foreground text-xs uppercase">
              <tr>
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Category</th>
                <th className="px-4 py-3 font-medium text-right">Morning</th>
                <th className="px-4 py-3 font-medium text-right">Evening</th>
                <th className="px-4 py-3 font-medium text-right">Extra</th>
                <th className="px-4 py-3 font-medium text-right">Total</th>
                <th className="px-4 py-3 font-medium text-center">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.map((log) => (
                <tr key={log.id} className={log.archivedAt ? "opacity-50 bg-muted/10" : "hover:bg-muted/30"}>
                  <td className="px-4 py-3 whitespace-nowrap">{log.date}</td>
                  <td className="px-4 py-3 truncate max-w-[150px]">{log.categoryId}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {log.morningAmountMinor > 0 ? formatMoney(log.morningAmountMinor, log.currency) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {log.eveningAmountMinor > 0 ? formatMoney(log.eveningAmountMinor, log.currency) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground">
                    {log.extraAmountMinor > 0 ? formatMoney(log.extraAmountMinor, log.currency) : "-"}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatMoney(log.originalAmountMinor, log.currency)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {log.archivedAt ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-destructive/10 text-destructive">
                        Archived
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/transport/${log.id}`} className="text-primary hover:underline text-sm font-medium">
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
  );
}
