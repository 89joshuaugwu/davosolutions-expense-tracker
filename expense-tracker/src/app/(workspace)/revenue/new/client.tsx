"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { RevenueSource, CompanySettings } from "@/domain/models";

import type { CurrencyCode } from "@/domain/money";

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
  const [currency, setCurrency] = useState<CurrencyCode>(settings.baseCurrency);
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
    <div>
      <div className="page-heading">
        <div>
          <h1>Record Revenue</h1>
          <p>Log new income for your company.</p>
        </div>
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}

      <div className="panel form-panel" style={{ maxWidth: 640 }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>
                Date <span style={{ color: "#c4403b" }}>*</span>
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>
                Revenue Source <span style={{ color: "#c4403b" }}>*</span>
              </label>
              <select
                required
                value={sourceId}
                onChange={(e) => setSourceId(e.target.value)}
                disabled={loading}
              >
                <option value="" disabled>Select a source</option>
                {sources.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {sources.length === 0 && (
                <p className="field-hint">
                  No active sources. Please add one first.
                </p>
              )}
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>
                Amount <span style={{ color: "#c4403b" }}>*</span>
              </label>
              <input
                type="number"
                required
                min="0.01"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={loading}
              />
            </div>

            <div className="form-group">
              <label>
                Currency <span style={{ color: "#c4403b" }}>*</span>
              </label>
              <select
                required
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                disabled={loading}
              >
                {settings.enabledCurrencies.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of the income"
              disabled={loading}
              maxLength={200}
            />
          </div>

          <div className="form-group">
            <label>Additional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any extra details..."
              disabled={loading}
              maxLength={1000}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              onClick={() => router.back()}
              className="button secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={loading || !sourceId || !amount}
            >
              {loading ? "Saving..." : "Record Revenue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
