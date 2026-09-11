"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { currentBusinessDate } from "@/domain/dates";

interface Category {
  id: string;
  name: string;
}

export function NewBillForm() {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);
  
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [formData, setFormData] = useState({
    name: "",
    provider: "",
    categoryId: "",
    expectedAmount: "",
    currency: "NGN",
    frequency: "monthly",
    nextDueDate: currentBusinessDate(),
    notes: "",
  });

  useEffect(() => {
    fetch("/api/categories?type=bill")
      .then(res => res.json())
      .then(data => {
        setCategories(data.categories || []);
        if (data.categories?.length > 0) {
          setFormData(prev => ({ ...prev, categoryId: data.categories[0].id }));
        }
      })
      .catch(err => console.error("Failed to load categories", err))
      .finally(() => setLoadingCats(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/bills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          idempotencyKey,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create bill");
      }

      router.push(`/bills/${data.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submission failed");
      setSubmitting(false);
    }
  };

  return (
    <div className="form-page">
      <div className="page-heading compact-heading">
        <div>
          <p className="eyebrow">BILLS & REMINDERS</p>
          <h1>Create scheduled bill</h1>
          <p>Define the commitment now. An expense is posted only when a due occurrence is paid.</p>
        </div>
        <Link href="/bills" className="button secondary"><ArrowLeft size={16} /> Back to bills</Link>
      </div>

      <section className="panel form-panel">
        <form onSubmit={handleSubmit}>
          {error && (
            <div className="form-error" role="alert">
              <AlertCircle size={17} />
              <p>{error}</p>
            </div>
          )}

          {!loadingCats && categories.length === 0 ? <div className="notice warning" role="status">
            No active bill category is configured. Add one in <Link className="text-link" href="/settings">Settings</Link> before saving this bill.
          </div> : null}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="name">Bill name</label>
              <input
                id="name"
                required
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Office Internet"
              />
            </div>
            <div className="form-group">
              <label htmlFor="provider">Provider</label>
              <input
                id="provider"
                required
                value={formData.provider}
                onChange={e => setFormData(prev => ({ ...prev, provider: e.target.value }))}
                placeholder="e.g. MTN"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="category">Category</label>
              <select
                id="category"
                required
                disabled={loadingCats}
                value={formData.categoryId}
                onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value }))}
              >
                {categories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="frequency">Frequency</label>
              <select
                id="frequency"
                required
                value={formData.frequency}
                onChange={e => setFormData(prev => ({ ...prev, frequency: e.target.value }))}
              >
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
                <option value="one_time">One-Time</option>
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="amount">Expected amount</label>
              <div className="split-input">
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  value={formData.expectedAmount}
                  onChange={e => setFormData(prev => ({ ...prev, expectedAmount: e.target.value }))}
                  placeholder="0.00"
                />
                <select
                  value={formData.currency}
                  onChange={e => setFormData(prev => ({ ...prev, currency: e.target.value }))}
                  aria-label="Currency"
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="nextDueDate">Next due date</label>
              <input
                id="nextDueDate"
                type="date"
                required
                value={formData.nextDueDate}
                onChange={e => setFormData(prev => ({ ...prev, nextDueDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="notes">Notes <span className="optional-label">Optional</span></label>
            <textarea
              id="notes"
              rows={3}
              value={formData.notes}
              onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              placeholder="Any additional information..."
            />
          </div>

          <div className="form-actions">
            <Link href="/bills" className="button secondary">Cancel</Link>
            <button
              type="submit"
              disabled={submitting || loadingCats || categories.length === 0}
              className="button primary"
            >
              {submitting ? (
                <>Saving...</>
              ) : (
                <>
                  <Save size={16} /> Save scheduled bill
                </>
              )}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
