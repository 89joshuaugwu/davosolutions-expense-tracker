"use client";

import { useState, useCallback, useId } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, PaperclipIcon, Send } from "lucide-react";
import type { Category } from "@/domain/models";
import type { CurrencyCode } from "@/domain/money";
import { CURRENCIES } from "@/domain/money";

interface Props {
  categories: Category[];
  baseCurrency: CurrencyCode;
  enabledCurrencies: CurrencyCode[];
  userRole: "super_admin" | "secretary";
}

type FieldErrors = Record<string, string>;
type FormState = "idle" | "submitting" | "success" | "error";

export function NewExpenseForm({ categories, baseCurrency, enabledCurrencies, userRole }: Props) {
  const formId = useId();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [frequency, setFrequency] = useState<string>("one_time");
  const [notes, setNotes] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [globalError, setGlobalError] = useState("");
  const [formState, setFormState] = useState<FormState>("idle");
  const [createdId, setCreatedId] = useState<string | null>(null);

  const resetErrors = useCallback(() => {
    setFieldErrors({});
    setGlobalError("");
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      if (formState === "submitting") return;

      resetErrors();
      setFormState("submitting");

      // Generate idempotency key per submit attempt
      const idempotencyKey = crypto.randomUUID();

      try {
        const response = await fetch("/api/expenses", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: title.trim(),
            amount: amount.trim(),
            currency,
            categoryId,
            date,
            frequency,
            notes: notes.trim(),
            idempotencyKey,
            attachmentIds: [],
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          if (data.fieldErrors) {
            setFieldErrors(data.fieldErrors);
          }
          setGlobalError(data.error || "Failed to save expense.");
          setFormState("error");
          return;
        }

        setCreatedId(data.id);
        setFormState("success");
      } catch {
        setGlobalError("Network error. Please check your connection and try again.");
        setFormState("error");
      }
    },
    [title, amount, currency, categoryId, date, frequency, notes, formState, resetErrors],
  );

  // Only show base currency in dropdown for now (foreign currencies need M2)
  const availableCurrencies = enabledCurrencies.filter((c) => c === baseCurrency);

  // Simple client-side conversion preview
  const previewAmount = (() => {
    if (!amount.trim()) return null;
    const match = /^(0|[1-9]\d*)(?:\.(\d+))?$/.exec(amount.trim());
    if (!match) return null;
    return amount.trim();
  })();

  if (formState === "success") {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "var(--space-8) var(--space-6)" }}>
        <span className="empty-icon" style={{ background: "var(--success-bg)", color: "var(--success)" }}>
          <Check size={28} />
        </span>
        <h2 style={{ marginTop: "var(--space-4)" }}>Expense recorded</h2>
        <p style={{ color: "var(--muted)", marginTop: "var(--space-2)" }}>
          Your expense has been saved and is now part of the financial record.
        </p>
        <div style={{ display: "flex", gap: "var(--space-3)", justifyContent: "center", marginTop: "var(--space-5)" }}>
          <Link className="button primary" href={`/expenses/${createdId}`}>
            View record
          </Link>
          <Link className="button secondary" href="/expenses/new">
            Add another
          </Link>
        </div>
        {userRole === "secretary" && (
          <p className="placeholder-note" style={{ marginTop: "var(--space-4)" }}>
            <AlertCircle size={15} /> This submission is final and cannot be edited.
          </p>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} id={formId} className="expense-form">
      {globalError && (
        <p className="form-error" role="alert">
          <AlertCircle size={16} /> {globalError}
        </p>
      )}

      <div className="panel form-panel">
        <h2>Expense details</h2>

        <div className="form-group">
          <label htmlFor={`${formId}-title`}>Title / Description *</label>
          <input
            id={`${formId}-title`}
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Office supplies, internet bill"
            maxLength={200}
            required
            autoFocus
            aria-invalid={!!fieldErrors["title"]}
            aria-describedby={fieldErrors["title"] ? `${formId}-title-error` : undefined}
          />
          {fieldErrors["title"] && (
            <p className="field-error" id={`${formId}-title-error`} role="alert">
              {fieldErrors["title"]}
            </p>
          )}
        </div>

        <div className="form-row">
          <div className="form-group" style={{ flex: 2 }}>
            <label htmlFor={`${formId}-amount`}>Amount *</label>
            <div className="input-with-prefix">
              <span className="input-prefix">{CURRENCIES[currency]?.symbol ?? "₦"}</span>
              <input
                id={`${formId}-amount`}
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                maxLength={32}
                required
                aria-invalid={!!fieldErrors["amount"]}
                aria-describedby={fieldErrors["amount"] ? `${formId}-amount-error` : undefined}
              />
            </div>
            {fieldErrors["amount"] && (
              <p className="field-error" id={`${formId}-amount-error`} role="alert">
                {fieldErrors["amount"]}
              </p>
            )}
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor={`${formId}-currency`}>Currency *</label>
            <select
              id={`${formId}-currency`}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
            >
              {availableCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c} — {CURRENCIES[c]?.name}
                </option>
              ))}
            </select>
            {enabledCurrencies.length > 1 && currency === baseCurrency && (
              <p className="field-hint">Foreign currency rates not yet configured.</p>
            )}
          </div>
        </div>

        {previewAmount && currency === baseCurrency && (
          <div className="conversion-preview">
            <span>Dashboard amount:</span>
            <strong>
              {CURRENCIES[baseCurrency]?.symbol}
              {previewAmount}
            </strong>
          </div>
        )}

        <div className="form-row">
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor={`${formId}-category`}>Category *</label>
            <select
              id={`${formId}-category`}
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              aria-invalid={!!fieldErrors["categoryId"]}
            >
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
            {fieldErrors["categoryId"] && (
              <p className="field-error" role="alert">
                {fieldErrors["categoryId"]}
              </p>
            )}
          </div>
          <div className="form-group" style={{ flex: 1 }}>
            <label htmlFor={`${formId}-date`}>Expense date *</label>
            <input
              id={`${formId}-date`}
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
              aria-invalid={!!fieldErrors["date"]}
            />
            {fieldErrors["date"] && (
              <p className="field-error" role="alert">
                {fieldErrors["date"]}
              </p>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor={`${formId}-frequency`}>Frequency *</label>
          <select id={`${formId}-frequency`} value={frequency} onChange={(e) => setFrequency(e.target.value)}>
            <option value="one_time">One-time</option>
            <option value="daily">Daily</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </select>
          <p className="field-hint">Frequency is descriptive for reporting purposes only.</p>
        </div>

        <div className="form-group">
          <label htmlFor={`${formId}-notes`}>Notes</label>
          <textarea
            id={`${formId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional details, references, or context"
            rows={3}
            maxLength={2000}
          />
        </div>

        <div className="form-group">
          <label>Attachment</label>
          <div className="attachment-placeholder">
            <PaperclipIcon size={16} />
            <span>Attachment support is coming in the next phase.</span>
          </div>
        </div>
      </div>

      {userRole === "secretary" && (
        <div className="notice" role="status">
          <AlertCircle size={16} />
          <span>Your submission is final once saved. Only a Super Admin can make corrections afterward.</span>
        </div>
      )}

      <div className="form-actions">
        <Link className="button secondary" href="/expenses">
          Cancel
        </Link>
        <button className="button primary" type="submit" disabled={formState === "submitting"}>
          {formState === "submitting" ? (
            <>
              <Loader2 size={16} className="spin" /> Saving…
            </>
          ) : (
            <>
              <Send size={16} /> Record expense
            </>
          )}
        </button>
      </div>
    </form>
  );
}
