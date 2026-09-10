"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RevenueSource, CompanySettings } from "@/domain/models";

// Use crypto.randomUUID() if available, otherwise a simple fallback
function generateIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

export function RevenueFormClient({ 
  sources, 
  settings 
}: { 
  sources: RevenueSource[],
  settings: CompanySettings 
}) {
  const router = useRouter();
  
  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [sourceId, setSourceId] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(settings.baseCurrency);
  const [description, setDescription] = useState("");
  const [notes, setNotes] = useState("");
  const [idempotencyKey] = useState(generateIdempotencyKey);
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/revenue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          sourceId,
          amount,
          currency,
          description,
          notes,
          idempotencyKey,
          attachmentIds: [], // We can add file upload later
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to record revenue");
      }

      router.push("/revenue");
      router.refresh();
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="layout-panel max-w-2xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Record Revenue</h1>
        <p className="text-sm text-gray-500 mt-1">Log new income for your company.</p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-field"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Revenue Source <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={sourceId}
              onChange={(e) => setSourceId(e.target.value)}
              className="input-field"
              disabled={loading}
            >
              <option value="" disabled>Select a source</option>
              {sources.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
            {sources.length === 0 && (
              <p className="text-xs text-red-500 mt-1">
                No active sources. Please add one first.
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Amount <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="input-field"
              disabled={loading}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Currency <span className="text-red-500">*</span>
            </label>
            <select
              required
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="input-field"
              disabled={loading}
            >
              {settings.enabledCurrencies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Description
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description of the income"
            className="input-field"
            disabled={loading}
            maxLength={200}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Additional Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any extra details..."
            className="input-field min-h-[100px] py-2"
            disabled={loading}
            maxLength={1000}
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
          <button
            type="button"
            onClick={() => router.back()}
            className="btn-secondary"
            disabled={loading}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="btn-primary"
            disabled={loading || !sourceId || !amount}
          >
            {loading ? "Saving..." : "Record Revenue"}
          </button>
        </div>
      </form>
    </div>
  );
}
