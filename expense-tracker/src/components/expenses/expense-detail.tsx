"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AlertCircle, ArrowLeft, Calendar, Check, Loader2, LockKeyhole, Trash2, Paperclip, FileText, Image as ImageIcon } from "lucide-react";
import { CURRENCIES, formatMoney, type CurrencyCode } from "@/domain/money";
import type { Frequency, AttachmentReference } from "@/domain/models";

interface ExpenseDetailData {
  id: string;
  title: string;
  originalAmountMinor: number;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  exchangeRateSnapshot: string;
  rateDate: string;
  baseAmountMinor: number;
  categoryId: string;
  date: string;
  frequency: Frequency;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
  archivedBy: string | null;
  revision: number;
  attachments?: AttachmentReference[];
}

const FREQUENCY_LABELS: Record<string, string> = {
  one_time: "One-time",
  daily: "Daily",
  monthly: "Monthly",
  yearly: "Yearly",
};

export function ExpenseDetail({ expenseId, isSuperAdmin }: { expenseId: string; isSuperAdmin: boolean }) {
  const [expense, setExpense] = useState<ExpenseDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [archiving, setArchiving] = useState(false);
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [reason, setReason] = useState("");

  async function fetchDetail() {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`/api/expenses/${expenseId}`);
      const data = await response.json();
      if (!response.ok) { setError(data.error || "Failed to load expense."); return; }
      setExpense(data.expense);
    } catch { setError("Network error."); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/expenses/${expenseId}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) { setError(json.error || "Failed to load expense."); return; }
        setExpense(json.expense);
      } catch { if (!cancelled) setError("Network error."); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [expenseId]);

  const handleArchive = async () => {
    if (!expense || !reason.trim()) return;
    setArchiving(true);
    setActionError("");
    setActionSuccess("");
    try {
      const response = await fetch(`/api/expenses/${expenseId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim(), expectedRevision: expense.revision }),
      });
      const data = await response.json();
      if (!response.ok) {
        setActionError(data.error || "Archive failed.");
      } else {
        setActionSuccess("Expense archived successfully.");
        setReason("");
        fetchDetail();
      }
    } catch {
      setActionError("Network error.");
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="loading-state">
        <Loader2 size={24} className="spin" />
        <p>Loading expense…</p>
      </div>
    );
  }

  if (error || !expense) {
    return (
      <div className="panel empty-state">
        <AlertCircle size={28} />
        <h3>{error || "Expense not found"}</h3>
        <Link className="button secondary" href="/expenses">
          <ArrowLeft size={16} /> Back to expenses
        </Link>
      </div>
    );
  }

  return (
    <div className="expense-detail">
      {expense.archivedAt && (
        <div className="notice warning" role="status">
          <Trash2 size={16} /> This expense has been archived and is excluded from financial reports.
        </div>
      )}

      <div className="panel detail-panel">
        <div className="detail-header">
          <div>
            <h2>{expense.title}</h2>
            <div className="detail-meta">
              <span className="badge neutral">{FREQUENCY_LABELS[expense.frequency] ?? expense.frequency}</span>
              <span>
                <Calendar size={14} /> {expense.date}
              </span>
            </div>
          </div>
          <div className="detail-amount">
            <strong className="amount-primary">{formatMoney(expense.baseAmountMinor, expense.baseCurrency)}</strong>
            {expense.currency !== expense.baseCurrency && (
              <small className="amount-secondary">
                Original: {CURRENCIES[expense.currency]?.symbol}
                {(expense.originalAmountMinor / 100).toFixed(2)} at {expense.exchangeRateSnapshot}
              </small>
            )}
          </div>
        </div>

        <div className="detail-grid">
          <div className="detail-field">
            <label>Category</label>
            <span>{expense.categoryId}</span>
          </div>
          <div className="detail-field">
            <label>Currency</label>
            <span>
              {expense.currency} ({CURRENCIES[expense.currency]?.name})
            </span>
          </div>
          <div className="detail-field">
            <label>Exchange Rate</label>
            <span>
              {expense.currency === expense.baseCurrency ? "Identity (1:1)" : `${expense.exchangeRateSnapshot} (${expense.rateDate})`}
            </span>
          </div>
          <div className="detail-field">
            <label>Recorded By</label>
            <span>{expense.createdBy}</span>
          </div>
          <div className="detail-field">
            <label>Recorded At</label>
            <span>{new Date(expense.createdAt).toLocaleString()}</span>
          </div>
          <div className="detail-field">
            <label>Revision</label>
            <span>{expense.revision}</span>
          </div>
        </div>

        {expense.notes && (
          <div className="detail-notes">
            <label>Notes</label>
            <p>{expense.notes}</p>
          </div>
        )}

        <div className="detail-field">
          <label>Attachments</label>
          {expense.attachments && expense.attachments.length > 0 ? (
            <ul className="attachment-list">
              {expense.attachments.map((att) => (
                <li key={att.id} className="attachment-item">
                  <div className="attachment-info">
                    {att.contentType.startsWith("image/") ? <ImageIcon size={16} /> : <FileText size={16} />}
                    <span className="filename" title={att.fileName}>{att.fileName}</span>
                    <span className="filesize">({Math.round(att.sizeBytes / 1024)} KB)</span>
                  </div>
                  <div className="attachment-actions">
                    <a href={`/api/attachments/${att.id}`} target="_blank" rel="noopener noreferrer" className="button secondary" style={{ padding: "var(--space-1) var(--space-2)", fontSize: "var(--text-xs)" }}>
                      Download
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <div className="attachment-placeholder">
              <Paperclip size={14} />
              <span>No attachments</span>
            </div>
          )}
        </div>
      </div>

      {actionError && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} /> {actionError}
        </p>
      )}
      {actionSuccess && (
        <p className="notice success" role="status">
          <Check size={16} /> {actionSuccess}
        </p>
      )}

      {isSuperAdmin && !expense.archivedAt && (
        <div className="panel admin-actions">
          <h3>Administrative actions</h3>
          <p className="field-hint">Corrections and archives are recorded in the audit trail.</p>
          <div className="form-group">
            <label htmlFor="admin-reason">Reason *</label>
            <textarea
              id="admin-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this correction or archive needed?"
              rows={2}
              maxLength={1000}
            />
          </div>
          <div className="form-actions">
            <button
              className="button danger"
              onClick={handleArchive}
              disabled={archiving || !reason.trim()}
            >
              {archiving ? <Loader2 size={16} className="spin" /> : <Trash2 size={16} />}
              Archive expense
            </button>
          </div>
        </div>
      )}

      {!isSuperAdmin && (
        <div className="notice" role="status">
          <LockKeyhole size={16} />
          <span>This record is final. Only a Super Admin can make corrections.</span>
        </div>
      )}
    </div>
  );
}
