"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { currentReportingMonth } from "@/domain/dates";

export function NewFundForm() {
  const router = useRouter();
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  // Default to current month YYYY-MM
  const currentMonth = currentReportingMonth();

  const [formData, setFormData] = useState({
    month: currentMonth,
    originalAmount: "",
    currency: "NGN",
    source: "",
    notes: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/monthly-funds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create fund");
      }

      router.push(`/monthly-funds/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="panel form-panel" style={{ maxWidth: 650, margin: "0 auto" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <Link href="/monthly-funds" className="icon-button">
          <ArrowLeft size={20} />
        </Link>
        <h2 style={{ margin: 0 }}>Allocate Monthly Fund</h2>
      </div>

      <div style={{ padding: 16, background: "var(--background)", borderBottom: "1px solid var(--line)", borderRadius: "8px 8px 0 0" }}>
        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Define the starting fund pool for a reporting month. This does <strong>not</strong> post a ledger entry.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="expense-form">
        {error && (
          <div className="form-error">
            <AlertCircle size={16} />
            <p>{error}</p>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="month">Reporting Month *</label>
            <input
              id="month"
              type="month"
              required
              value={formData.month}
              onChange={e => setFormData(prev => ({ ...prev, month: e.target.value }))}
            />
          </div>

          <div className="form-group">
            <label htmlFor="source">Source / Reference (Optional)</label>
            <input
              id="source"
              value={formData.source}
              onChange={e => setFormData(prev => ({ ...prev, source: e.target.value }))}
              placeholder="e.g. Bank Transfer Ref"
            />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="amount">Opening Amount *</label>
          <div style={{ display: "flex", gap: 8 }}>
            <input
              id="amount"
              type="number"
              step="0.01"
              min="0"
              required
              value={formData.originalAmount}
              onChange={e => setFormData(prev => ({ ...prev, originalAmount: e.target.value }))}
              placeholder="0.00"
              style={{ flex: 1 }}
            />
            <select
              value={formData.currency}
              onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
              style={{ width: 100 }}
            >
              <option value="NGN">NGN</option>
              <option value="USD">USD</option>
              <option value="EUR">EUR</option>
              <option value="GBP">GBP</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="notes">Notes (Optional)</label>
          <textarea
            id="notes"
            rows={3}
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Any additional context..."
          />
        </div>

        <div className="form-actions">
          <Link href="/monthly-funds" className="button secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={submitting}
            className="button primary"
          >
            {submitting ? (
              "Saving..."
            ) : (
              <>Allocate Fund <Save size={16} /></>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
