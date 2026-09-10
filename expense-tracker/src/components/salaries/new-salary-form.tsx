"use client";

import { useState, useCallback, useId } from "react";
import Link from "next/link";
import { AlertCircle, Check, Loader2, Send } from "lucide-react";
import type { Category } from "@/domain/models";
import type { CurrencyCode } from "@/domain/money";
import { CURRENCIES } from "@/domain/money";
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
  const [period, setPeriod] = useState(new Date().toISOString().slice(0, 7)); // YYYY-MM
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<CurrencyCode>(baseCurrency);
  const [categoryId, setCategoryId] = useState(categories[0]?.id ?? "");
  const [status, setStatus] = useState<"pending" | "paid">("pending");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
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
      <div className="max-w-2xl mx-auto p-6 bg-white border border-green-100 rounded-xl shadow-sm text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Salary Submitted</h2>
        <p className="text-gray-600">The salary record has been created successfully.</p>
        <div className="flex justify-center gap-4 pt-6">
          <Link
            href={`/salaries/${createdId}`}
            className="px-6 py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            View Record
          </Link>
          <button
            onClick={() => {
              setFormState("idle");
              setWorkerName("");
              setPeriod(new Date().toISOString().slice(0, 7));
              setAmount("");
              setNotes("");
              setAttachments([]);
              setCreatedId(null);
            }}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Log Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-6 py-5 border-b border-gray-100 bg-gray-50/50">
        <h2 className="text-xl font-semibold text-gray-900">Log Salary</h2>
        <p className="text-sm text-gray-500 mt-1">Record a new salary or wage payment.</p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 space-y-8">
        {globalError && (
          <div className="p-4 bg-red-50 text-red-700 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
            <p className="text-sm font-medium">{globalError}</p>
          </div>
        )}

        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor={`${formId}-workerName`} className="block text-sm font-medium text-gray-700">
                Worker Name (Optional)
              </label>
              <input
                type="text"
                id={`${formId}-workerName`}
                value={workerName}
                onChange={(e) => setWorkerName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                disabled={formState === "submitting"}
              />
              {fieldErrors.workerName && <p className="text-sm text-red-600">{fieldErrors.workerName}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor={`${formId}-period`} className="block text-sm font-medium text-gray-700">
                Period
              </label>
              <input
                type="month"
                id={`${formId}-period`}
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                disabled={formState === "submitting"}
              />
              {fieldErrors.period && <p className="text-sm text-red-600">{fieldErrors.period}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label htmlFor={`${formId}-amount`} className="block text-sm font-medium text-gray-700">
                Amount <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <span className="text-gray-500 sm:text-sm">{CURRENCIES[currency]?.symbol}</span>
                </div>
                <input
                  type="text"
                  inputMode="decimal"
                  id={`${formId}-amount`}
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                  disabled={formState === "submitting"}
                />
              </div>
              {fieldErrors.amount && <p className="text-sm text-red-600">{fieldErrors.amount}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor={`${formId}-currency`} className="block text-sm font-medium text-gray-700">
                Currency <span className="text-red-500">*</span>
              </label>
              <select
                id={`${formId}-currency`}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none bg-white"
                disabled={formState === "submitting"}
              >
                {enabledCurrencies.map((c) => (
                  <option key={c} value={c}>
                    {c} ({CURRENCIES[c]?.symbol})
                  </option>
                ))}
              </select>
              {fieldErrors.currency && <p className="text-sm text-red-600">{fieldErrors.currency}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor={`${formId}-category`} className="block text-sm font-medium text-gray-700">
              Category <span className="text-red-500">*</span>
            </label>
            <select
              id={`${formId}-category`}
              required
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none bg-white"
              disabled={formState === "submitting"}
            >
              <option value="" disabled>Select a category</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && <p className="text-sm text-red-600">{fieldErrors.categoryId}</p>}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 p-4 bg-gray-50 rounded-lg border border-gray-100">
            <div className="space-y-2">
              <label htmlFor={`${formId}-status`} className="block text-sm font-medium text-gray-700">
                Status <span className="text-red-500">*</span>
              </label>
              <select
                id={`${formId}-status`}
                required
                value={status}
                onChange={(e) => setStatus(e.target.value as "pending" | "paid")}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none bg-white"
                disabled={formState === "submitting"}
              >
                <option value="pending">Pending (Not Paid)</option>
                <option value="paid">Paid</option>
              </select>
            </div>

            {status === "paid" && (
              <div className="space-y-2 animate-in fade-in slide-in-from-top-1">
                <label htmlFor={`${formId}-paymentDate`} className="block text-sm font-medium text-gray-700">
                  Payment Date <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  id={`${formId}-paymentDate`}
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none"
                  disabled={formState === "submitting"}
                />
                {fieldErrors.paymentDate && <p className="text-sm text-red-600">{fieldErrors.paymentDate}</p>}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <label htmlFor={`${formId}-notes`} className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              id={`${formId}-notes`}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any additional details..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow outline-none resize-y"
              disabled={formState === "submitting"}
            />
            {fieldErrors.notes && <p className="text-sm text-red-600">{fieldErrors.notes}</p>}
          </div>

          <div className="space-y-2 pt-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Attachments (Receipts/Invoices)</label>
            <AttachmentUpload
              attachments={attachments}
              onChange={setAttachments}
              disabled={formState === "submitting"}
            />
            {fieldErrors.attachmentIds && <p className="text-sm text-red-600 mt-1">{fieldErrors.attachmentIds}</p>}
          </div>
        </div>

        <div className="pt-6 border-t border-gray-100 flex items-center justify-end gap-4">
          <Link
            href="/salaries"
            className="px-5 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={formState === "submitting"}
            className="inline-flex items-center justify-center gap-2 px-6 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors min-w-[120px]"
          >
            {formState === "submitting" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                Submit <Send className="w-4 h-4" />
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
