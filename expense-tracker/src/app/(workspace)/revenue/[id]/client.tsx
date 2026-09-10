"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RevenueRecord, RevenueSource } from "@/domain/models";

export function RevenueDetailClient({
  initialRecord,
  sources,
}: {
  initialRecord: RevenueRecord;
  sources: RevenueSource[];
}) {
  const router = useRouter();
  const [record, setRecord] = useState(initialRecord);
  const [isEditing, setIsEditing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  // Edit State
  const [date, setDate] = useState(record.date);
  const [sourceId, setSourceId] = useState(record.sourceId);
  const [description, setDescription] = useState(record.description);
  const [notes, setNotes] = useState(record.notes);
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const formatMoney = (minorUnits: number, cur: string) => {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: cur,
    }).format(minorUnits / 100);
  };

  const getSourceName = (id: string) => {
    return sources.find((s) => s.id === id)?.name || "Unknown Source";
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for this correction.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/revenue/${record.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          sourceId,
          description,
          notes,
          expectedRevision: record.revision,
          reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to update revenue record");
      }

      // Reload
      router.refresh();
      setIsEditing(false);
      setReason("");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("Please provide a reason for archiving.");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const res = await fetch(`/api/revenue/${record.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expectedRevision: record.revision,
          reason,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to archive revenue record");
      }

      router.push("/revenue");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (record.archivedAt) {
    return (
      <div className="layout-panel max-w-2xl mx-auto">
        <div className="bg-red-50 p-6 rounded-xl border border-red-100 text-center">
          <h2 className="text-xl font-semibold text-red-700 mb-2">Record Archived</h2>
          <p className="text-red-600 mb-4">This revenue record was archived on {new Date(record.archivedAt).toLocaleString()}</p>
          <button onClick={() => router.back()} className="btn-secondary">Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="layout-panel max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Revenue Details</h1>
          <p className="text-sm text-gray-500 mt-1">ID: {record.id}</p>
        </div>
        <div className="flex gap-2">
          {!isEditing && !isArchiving && (
            <>
              <button onClick={() => setIsEditing(true)} className="btn-secondary">
                Edit
              </button>
              <button onClick={() => setIsArchiving(true)} className="btn-secondary text-red-600 hover:text-red-700">
                Archive
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      {isEditing ? (
        <form onSubmit={handleUpdate} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
          <h2 className="text-lg font-medium text-gray-900 mb-4">Edit Record</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="input-field" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source</label>
              <select value={sourceId} onChange={(e) => setSourceId(e.target.value)} className="input-field" required>
                {sources.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className="input-field" />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="input-field min-h-[100px]" />
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
            <label className="block text-sm font-medium text-blue-900 mb-1">Reason for Correction <span className="text-red-500">*</span></label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input-field bg-white" placeholder="Why are you making this change?" required />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <button type="button" onClick={() => setIsEditing(false)} className="btn-secondary" disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading || !reason.trim()}>Save Changes</button>
          </div>
        </form>
      ) : isArchiving ? (
        <form onSubmit={handleArchive} className="bg-white p-6 rounded-xl border border-red-200 shadow-sm space-y-6">
          <h2 className="text-lg font-medium text-red-700 mb-2">Archive Record</h2>
          <p className="text-sm text-gray-600">Are you sure you want to archive this revenue record? This will also remove its impact from the ledger.</p>
          
          <div className="bg-red-50 p-4 rounded-lg border border-red-100">
            <label className="block text-sm font-medium text-red-900 mb-1">Reason for Archiving <span className="text-red-500">*</span></label>
            <input type="text" value={reason} onChange={(e) => setReason(e.target.value)} className="input-field bg-white" placeholder="E.g., entered by mistake" required />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-red-100">
            <button type="button" onClick={() => setIsArchiving(false)} className="btn-secondary" disabled={loading}>Cancel</button>
            <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors" disabled={loading || !reason.trim()}>Archive Record</button>
          </div>
        </form>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-500">Amount</p>
              <h2 className="text-3xl font-bold text-gray-900 mt-1">
                {formatMoney(record.originalAmountMinor, record.currency)}
              </h2>
            </div>
            {record.currency !== record.baseCurrency && (
              <div className="text-right">
                <p className="text-sm text-gray-500">Base Currency ({record.baseCurrency})</p>
                <p className="text-xl font-medium text-gray-900 mt-1">
                  {formatMoney(record.baseAmountMinor, record.baseCurrency)}
                </p>
                <p className="text-xs text-gray-500 mt-1">Rate: {record.exchangeRateSnapshot}</p>
              </div>
            )}
          </div>
          
          <div className="p-6 space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div>
                <p className="text-sm font-medium text-gray-500">Date</p>
                <p className="mt-1 text-sm text-gray-900">{record.date}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Source</p>
                <p className="mt-1 text-sm text-gray-900 font-medium">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                    {getSourceName(record.sourceId)}
                  </span>
                </p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Created At</p>
                <p className="mt-1 text-sm text-gray-900">{new Date(record.createdAt).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">Revision</p>
                <p className="mt-1 text-sm text-gray-900">{record.revision}</p>
              </div>
            </div>

            {record.description && (
              <div className="pt-6 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Description</p>
                <p className="text-sm text-gray-900">{record.description}</p>
              </div>
            )}

            {record.notes && (
              <div className="pt-6 border-t border-gray-100">
                <p className="text-sm font-medium text-gray-500 mb-1">Notes</p>
                <p className="text-sm text-gray-900 whitespace-pre-wrap">{record.notes}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
