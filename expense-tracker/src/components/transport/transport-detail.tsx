"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type { TransportLog } from "@/domain/models";
import { formatMoney } from "@/domain/money";
import { format } from "date-fns";
import { AlertTriangle, ArrowLeft } from "lucide-react";

export function TransportDetail({ id, isSuperAdmin }: { id: string; isSuperAdmin: boolean }) {
  const router = useRouter();
  const [log, setLog] = useState<TransportLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiveReason, setArchiveReason] = useState("");
  const [archiving, setArchiving] = useState(false);

  const fetchDetail = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/transport/${id}`);
      if (!res.ok) {
        if (res.status === 404) throw new Error("Transport log not found");
        throw new Error("Failed to load details");
      }
      setLog(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading data");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail]);

  const handleArchive = async () => {
    if (!log) return;
    if (!archiveReason.trim()) {
      alert("Please provide a reason for archiving");
      return;
    }
    
    setArchiving(true);
    try {
      const res = await fetch(`/api/transport/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "archive",
          reason: archiveReason,
          expectedRevision: log.revision,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => null);
        throw new Error(errData?.error || "Failed to archive");
      }
      
      await fetchDetail();
      setArchiveReason("");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Archive failed");
    } finally {
      setArchiving(false);
    }
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading details...</div>;
  if (error) return <div className="p-4 bg-red-50 text-red-700 rounded-md m-4">{error}</div>;
  if (!log) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-full transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900">Transport Log Details</h1>
        </div>
      </div>

      {log.archivedAt && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-red-800">Record Archived</h3>
            <p className="text-sm text-red-700 mt-1">
              This record was archived on {format(new Date(log.archivedAt), "PPpp")}. Its financial effect has been reversed.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Overview</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Date</div>
              <div className="text-gray-900">{log.date}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Total Amount</div>
              <div className="text-2xl font-bold text-gray-900">{formatMoney(log.originalAmountMinor, log.currency)}</div>
              {log.currency !== log.baseCurrency && (
                <div className="text-xs text-gray-500 mt-1.5 bg-gray-50 inline-block px-2 py-1 rounded">
                  Posted as {formatMoney(log.baseAmountMinor, log.baseCurrency)} (Rate: {log.exchangeRateSnapshot})
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-gray-500 mb-1">Category</div>
              <div className="text-gray-900 bg-gray-100 inline-block px-3 py-1 rounded-full text-sm">{log.categoryId}</div>
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Amount Breakdown</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Morning</span>
              <span className="font-medium text-gray-900">{formatMoney(log.morningAmountMinor, log.currency)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-gray-600">Evening</span>
              <span className="font-medium text-gray-900">{formatMoney(log.eveningAmountMinor, log.currency)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100 bg-blue-50/30 -mx-6 px-6">
              <span className="text-gray-900 font-medium">Extra</span>
              <span className="font-medium text-gray-900">{formatMoney(log.extraAmountMinor, log.currency)}</span>
            </div>
            {log.extraAmountMinor > 0 && (
              <div className="pt-2 bg-blue-50 p-3 rounded-lg border border-blue-100">
                <span className="text-xs font-semibold text-blue-800 uppercase tracking-wider block mb-1">Extra Reason</span>
                <span className="text-sm text-blue-900">{log.extraReason}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm md:col-span-2">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-lg font-semibold text-gray-900">Metadata & Notes</h3>
          </div>
          <div className="p-6 space-y-6">
            {log.notes && (
              <div>
                <div className="text-sm font-medium text-gray-500 mb-2">Notes</div>
                <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-100 whitespace-pre-wrap">{log.notes}</div>
              </div>
            )}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Created By</span>
                <span className="text-sm text-gray-900 truncate block">{log.createdBy}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Created At</span>
                <span className="text-sm text-gray-900">{format(new Date(log.createdAt), "MMM d, yyyy HH:mm")}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Revision</span>
                <span className="text-sm text-gray-900">v{log.revision}</span>
              </div>
              <div>
                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider block mb-1">Visibility</span>
                <span className="text-sm text-gray-900">{log.visibleToUserIds.length} user(s)</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {isSuperAdmin && !log.archivedAt && (
        <div className="bg-white border border-red-200 rounded-xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-red-100 bg-red-50">
            <h3 className="text-lg font-semibold text-red-900 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2" />
              Danger Zone
            </h3>
          </div>
          <div className="p-6">
            <p className="text-sm text-gray-600 mb-4">
              Archiving immediately reverses the financial ledger posting. This action cannot be undone.
            </p>
            <div className="flex flex-col sm:flex-row items-end gap-4 max-w-xl">
              <div className="flex-1 space-y-2 w-full">
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700">Archive Reason</label>
                <input 
                  id="reason"
                  type="text"
                  placeholder="Reason for archiving..." 
                  value={archiveReason} 
                  onChange={e => setArchiveReason(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-red-500 focus:border-red-500"
                />
              </div>
              <button 
                onClick={handleArchive} 
                disabled={archiving || !archiveReason.trim()}
                className="px-6 py-2.5 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {archiving ? "Archiving..." : "Archive Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
