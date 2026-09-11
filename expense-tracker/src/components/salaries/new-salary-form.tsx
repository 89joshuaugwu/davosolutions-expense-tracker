"use client";

import { useState, useCallback, useId } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, Send } from "lucide-react";
import type { Category } from "@/domain/models";
import type { CurrencyCode } from "@/domain/money";
import { CURRENCIES } from "@/domain/money";
import { currentBusinessDate, currentReportingMonth } from "@/domain/dates";
import { AttachmentUpload, type AttachmentItem } from "../attachments/attachment-upload";

interface Props {
  categories: Category[];
  baseCurrency: CurrencyCode;
  enabledCurrencies: CurrencyCode[];
  userRole: "super_admin" | "secretary";
}

type FieldErrors = Record<string, string>;
type FormState = "idle" | "submitting" | "success" | "error";

export function NewSalaryForm({ categories, baseCurrency, enabledCurrencies }: Props) {
  const formId = useId();
  const [workerName, setWorkerName] = useState("");
  const [period, setPeriod] = useState(currentReportingMonth());
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [status, setStatus] = useState<"pending" | "paid">("pending");
  const [paymentDate, setPaymentDate] = useState(currentBusinessDate());
  const [notes, setNotes] = useState("");
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
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
        const response = await fetch("/api/salaries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            workerName: workerName.trim() || undefined,
            period: period.trim() || undefined,
            amount: amount.trim(),
            currency,
            categoryId,
            status,
            paymentDate: status === "paid" ? paymentDate : undefined,
            notes: notes.trim() || undefined,
            attachmentIds: attachments.map((a) => a.id),
            idempotencyKey,
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          Object.keys(data.details).forEach((key: any) => {
            if (key !== "_errors" && data.details[key]._errors?.length) {
              errors[key] = data.details[key]._errors[0];
            }
          });
          setFieldErrors(errors);
          setGlobalError("Please fix the errors below.");
        } else {
          setGlobalError(data.error || "Failed to submit salary.");
        }
        setFormState("error");
      } catch {
        setGlobalError("A network error occurred.");
      } finally {
        setFormState("error");
      }
    },
    [
      workerName,
      period,
      amount,
      currency,
      categoryId,
      status,
      paymentDate,
      notes,
      attachments,
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
        <h1>Salary Submitted</h1>
        <p>The salary record has been created successfully.</p>
        <div className="form-actions" style={{ justifyContent: "center" }}>
          <Link href={`/salaries/${createdId}`} className="button secondary">
            View Record
          </Link>
          <button
            onClick={() => {
              setFormState("idle");
              setWorkerName("");
              setPeriod(currentReportingMonth());
              setAmount("");
              setNotes("");
              setAttachments([]);
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
      <h2>Log Salary</h2>

      <form onSubmit={handleSubmit} className="expense-form">
        {globalError && (
          <div className="form-error">
            <AlertCircle size={16} />
            <p>{globalError}</p>
          </div>
        )}

        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${formId}-workerName`}>Worker Name (Optional)</label>
            <input
              type="text"
              id={`${formId}-workerName`}
              value={workerName}
              onChange={(e) => setWorkerName(e.target.value)}
              placeholder="e.g. John Doe"
              disabled={formState === "submitting"}
            />
            {fieldErrors.workerName && <p className="field-error">{fieldErrors.workerName}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-period`}>Period</label>
            <input
              type="month"
              id={`${formId}-period`}
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={formState === "submitting"}
            />
            {fieldErrors.period && <p className="field-error">{fieldErrors.period}</p>}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor={`${formId}-amount`}>Amount *</label>
            <div className="input-with-prefix">
              <span className="input-prefix">{CURRENCIES[currency]?.symbol}</span>
              <input
                type="text"
                inputMode="decimal"
                id={`${formId}-amount`}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                disabled={formState === "submitting"}
              />
            </div>
            {fieldErrors.amount && <p className="field-error">{fieldErrors.amount}</p>}
          </div>

          <div className="form-group">
            <label htmlFor={`${formId}-currency`}>Currency *</label>
            <select
              id={`${formId}-currency`}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              disabled={formState === "submitting"}
            >
              {enabledCurrencies.map((c) => (
                <option key={c} value={c}>
                  {c} ({CURRENCIES[c]?.symbol})
                </option>
              ))}
            </select>
            {fieldErrors.currency && <p className="field-error">{fieldErrors.currency}</p>}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor={`${formId}-category`}>Category *</label>
          <select
            id={`${formId}-category`}
            required
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            disabled={formState === "submitting"}
          >
            <option value="" disabled>Select a category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          {fieldErrors.categoryId && <p className="field-error">{fieldErrors.categoryId}</p>}
        </div>

        <div className="form-row" style={{ padding: 15, background: "#fafbfd", borderRadius: 8, border: "1px solid var(--line)", marginBottom: 18 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor={`${formId}-status`}>Status *</label>
            <select
              id={`${formId}-status`}
              required
              value={status}
              onChange={(e) => setStatus(e.target.value as "pending" | "paid")}
              disabled={formState === "submitting"}
            >
              <option value="pending">Pending (Not Paid)</option>
              <option value="paid">Paid</option>
            </select>
          </div>

          {status === "paid" && (
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor={`${formId}-paymentDate`}>Payment Date *</label>
              <input
                type="date"
                id={`${formId}-paymentDate`}
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                disabled={formState === "submitting"}
              />
              {fieldErrors.paymentDate && <p className="field-error">{fieldErrors.paymentDate}</p>}
            </div>
          )}
        </div>

        <div className="form-group">
          <label htmlFor={`${formId}-notes`}>Notes</label>
          <textarea
            id={`${formId}-notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Any additional details..."
            disabled={formState === "submitting"}
          />
          {fieldErrors.notes && <p className="field-error">{fieldErrors.notes}</p>}
        </div>

        <div className="form-group">
          <label>Attachments (Receipts/Invoices)</label>
          <AttachmentUpload
            attachments={attachments}
            onChange={setAttachments}
            disabled={formState === "submitting"}
          />
          {fieldErrors.attachmentIds && <p className="field-error">{fieldErrors.attachmentIds}</p>}
        </div>

        <div className="form-actions">
          <Link href="/salaries" className="button secondary">
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
