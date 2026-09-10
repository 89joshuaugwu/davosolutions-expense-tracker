"use client";

import { useState, useCallback, useId } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, Send } from "lucide-react";
import type { CurrencyCode } from "@/domain/money";
import { CURRENCIES } from "@/domain/money";

interface Props {
  categories: { id: string; name: string }[];
  baseCurrency: CurrencyCode;
}

type FieldErrors = Record<string, string>;
type FormState = "idle" | "submitting" | "success" | "error";

export function NewTransportForm({ categories, baseCurrency }: Props) {
  const formId = useId();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [morningAmount, setMorningAmount] = useState("");
  const [eveningAmount, setEveningAmount] = useState("");
  const [extraAmount, setExtraAmount] = useState("");
  const [extraReason, setExtraReason] = useState("");
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

      const idempotencyKey = crypto.randomUUID();

      try {
        const response = await fetch("/api/transport", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            date: date.trim(),
            categoryId,
            currency,
            morningAmount: morningAmount.trim() || undefined,
            eveningAmount: eveningAmount.trim() || undefined,
            extraAmount: extraAmount.trim() || undefined,
            extraReason: extraReason.trim() || undefined,
            notes: notes.trim() || undefined,
            idempotencyKey,
            attachmentIds: [],
          }),
        });

        if (response.ok) {
          const result = await response.json();
          setCreatedId(result.id);
          setFormState("success");
          return;
        }

        const data = await response.json();
        if (data.details) {
          const errors: FieldErrors = {};
          data.details.forEach((err: { path: string[]; message: string }) => {
            if (err.path.length > 0) {
              errors[err.path[0]] = err.message;
            }
          });
          setFieldErrors(errors);
          setGlobalError("Please fix the errors below.");
        } else {
          setGlobalError(data.error || "Failed to submit transport log.");
        }
        setFormState("error");
      } catch {
        setGlobalError("A network error occurred.");
        setFormState("error");
      }
    },
    [
      date,
      categoryId,
      currency,
      morningAmount,
      eveningAmount,
      extraAmount,
      extraReason,
      notes,
      formState,
      resetErrors,
    ],
  );

  if (formState === "success" && createdId) {
    return (
      <div className="state-panel panel" style={{ margin: "0 auto" }}>
        <div className="empty-icon" style={{ margin: "0 auto 16px" }}>
          <Check size={28} />
        </div>
        <h1>Transport Logged</h1>
        <p>The transport record has been created successfully.</p>
        <div className="form-actions" style={{ justifyContent: "center" }}>
          <Link href={`/transport/${createdId}`} className="button secondary">
            View Record
          </Link>
          <button
            onClick={() => {
              setMorningAmount("");
              setEveningAmount("");
              setExtraAmount("");
              setExtraReason("");
              setNotes("");
              setFormState("idle");
              setCreatedId(null);
            }}
            className="button primary"
          >
            Log Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel form-panel" style={{ maxWidth: 650, margin: "0 auto" }}>
      <h2>Log Transport</h2>

      <form onSubmit={handleSubmit} className="expense-form">
        {globalError && (
          <div className="form-error">
            <AlertCircle size={16} />
            <p>{globalError}</p>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${formId}-date`}>Date *</label>
            <input
              id={`${formId}-date`}
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
            {fieldErrors.date && <p className="field-error">{fieldErrors.date}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-category`}>Category *</label>
            <select
              id={`${formId}-category`}
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.categoryId && <p className="field-error">{fieldErrors.categoryId}</p>}
          </div>
        </div>

        <div className="form-group" style={{ maxWidth: 200 }}>
          <label htmlFor={`${formId}-currency`}>Currency</label>
          <select
            id={`${formId}-currency`}
            value={currency}
            onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
          >
            {Object.entries(CURRENCIES).map(([code, def]) => (
              <option key={code} value={code}>
                {code} - {def.name}
              </option>
            ))}
          </select>
          {fieldErrors.currency && <p className="field-error">{fieldErrors.currency}</p>}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${formId}-morning`}>Morning</label>
            <div className="input-with-prefix">
              <span className="input-prefix">{CURRENCIES[currency]?.symbol}</span>
              <input
                id={`${formId}-morning`}
                type="text"
                placeholder="0.00"
                value={morningAmount}
                onChange={(e) => setMorningAmount(e.target.value)}
              />
            </div>
            {fieldErrors.morningAmount && <p className="field-error">{fieldErrors.morningAmount}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-evening`}>Evening</label>
            <div className="input-with-prefix">
              <span className="input-prefix">{CURRENCIES[currency]?.symbol}</span>
              <input
                id={`${formId}-evening`}
                type="text"
                placeholder="0.00"
                value={eveningAmount}
                onChange={(e) => setEveningAmount(e.target.value)}
              />
            </div>
            {fieldErrors.eveningAmount && <p className="field-error">{fieldErrors.eveningAmount}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-extra`}>Extra</label>
            <div className="input-with-prefix">
              <span className="input-prefix">{CURRENCIES[currency]?.symbol}</span>
              <input
                id={`${formId}-extra`}
                type="text"
                placeholder="0.00"
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value)}
              />
            </div>
            {fieldErrors.extraAmount && <p className="field-error">{fieldErrors.extraAmount}</p>}
          </div>
        </div>

        {extraAmount && extraAmount !== "0" && extraAmount.trim() !== "" && (
          <div className="form-group" style={{ padding: 15, background: "#fafbfd", borderRadius: 8, border: "1px solid var(--line)" }}>
            <label htmlFor={`${formId}-extra-reason`}>Reason for Extra Amount *</label>
            <input
              id={`${formId}-extra-reason`}
              type="text"
              required
              value={extraReason}
              onChange={(e) => setExtraReason(e.target.value)}
              placeholder="e.g. Client meeting in city center"
            />
            {fieldErrors.extraReason && <p className="field-error">{fieldErrors.extraReason}</p>}
          </div>
        )}

        <div className="form-group">
          <label htmlFor={`${formId}-notes`}>Notes (Optional)</label>
          <textarea
            id={`${formId}-notes`}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any additional context..."
          />
          {fieldErrors.notes && <p className="field-error">{fieldErrors.notes}</p>}
        </div>

        <div className="form-actions">
          <Link href="/transport" className="button secondary">
            Cancel
          </Link>
          <button
            type="submit"
            disabled={formState === "submitting"}
            className="button primary"
          >
            {formState === "submitting" ? (
              <Loader2 size={16} className="spin" />
            ) : (
              <>Submit <Send size={16} /></>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
