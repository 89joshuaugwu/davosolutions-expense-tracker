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
      <div className="max-w-2xl mx-auto p-6 bg-white border border-green-100 rounded-xl shadow-sm text-center space-y-6">
        <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
          <Check className="w-8 h-8 text-green-600" />
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Transport Logged</h2>
        <p className="text-gray-600">The transport record has been created successfully.</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Link
            href={`/transport/${createdId}`}
            className="px-6 py-2.5 bg-white border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
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
            className="px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Log Another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <form onSubmit={handleSubmit} className="space-y-8 bg-white p-6 md:p-8 rounded-xl shadow-sm border border-gray-100">
        {globalError && (
          <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md flex items-start">
            <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
            <p className="text-red-800 text-sm">{globalError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label htmlFor={`${formId}-date`} className="block text-sm font-medium text-gray-700">
              Date <span className="text-red-500">*</span>
            </label>
            <input
              id={`${formId}-date`}
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
            />
            {fieldErrors.date && <p className="text-sm text-red-600">{fieldErrors.date}</p>}
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
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
            {fieldErrors.categoryId && <p className="text-sm text-red-600">{fieldErrors.categoryId}</p>}
          </div>
        </div>

        <div className="border-t border-gray-100 pt-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900">Amounts</h3>

          <div className="space-y-2 max-w-[250px]">
            <label htmlFor={`${formId}-currency`} className="block text-sm font-medium text-gray-700">
              Currency
            </label>
            <select
              id={`${formId}-currency`}
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
            >
              {Object.entries(CURRENCIES).map(([code, def]) => (
                <option key={code} value={code}>
                  {code} - {def.name}
                </option>
              ))}
            </select>
            {fieldErrors.currency && <p className="text-sm text-red-600">{fieldErrors.currency}</p>}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="space-y-2">
              <label htmlFor={`${formId}-morning`} className="block text-sm font-medium text-gray-700">
                Morning
              </label>
              <input
                id={`${formId}-morning`}
                type="text"
                placeholder="0.00"
                value={morningAmount}
                onChange={(e) => setMorningAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {fieldErrors.morningAmount && <p className="text-sm text-red-600">{fieldErrors.morningAmount}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor={`${formId}-evening`} className="block text-sm font-medium text-gray-700">
                Evening
              </label>
              <input
                id={`${formId}-evening`}
                type="text"
                placeholder="0.00"
                value={eveningAmount}
                onChange={(e) => setEveningAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {fieldErrors.eveningAmount && <p className="text-sm text-red-600">{fieldErrors.eveningAmount}</p>}
            </div>

            <div className="space-y-2">
              <label htmlFor={`${formId}-extra`} className="block text-sm font-medium text-gray-700">
                Extra
              </label>
              <input
                id={`${formId}-extra`}
                type="text"
                placeholder="0.00"
                value={extraAmount}
                onChange={(e) => setExtraAmount(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              />
              {fieldErrors.extraAmount && <p className="text-sm text-red-600">{fieldErrors.extraAmount}</p>}
            </div>
          </div>

          {extraAmount && extraAmount !== "0" && extraAmount.trim() !== "" && (
            <div className="space-y-2 border-l-4 border-blue-500 pl-4 bg-blue-50/50 p-4 rounded-r-lg">
              <label htmlFor={`${formId}-extra-reason`} className="block text-sm font-medium text-gray-700">
                Reason for Extra Amount <span className="text-red-500">*</span>
              </label>
              <input
                id={`${formId}-extra-reason`}
                type="text"
                required
                value={extraReason}
                onChange={(e) => setExtraReason(e.target.value)}
                className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors bg-white"
                placeholder="e.g. Client meeting in city center"
              />
              {fieldErrors.extraReason && <p className="text-sm text-red-600">{fieldErrors.extraReason}</p>}
            </div>
          )}
        </div>

        <div className="border-t border-gray-100 pt-6 space-y-2">
          <label htmlFor={`${formId}-notes`} className="block text-sm font-medium text-gray-700">
            Notes (Optional)
          </label>
          <textarea
            id={`${formId}-notes`}
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors resize-y"
            placeholder="Any additional context..."
          />
          {fieldErrors.notes && <p className="text-sm text-red-600">{fieldErrors.notes}</p>}
        </div>

        <div className="pt-6 border-t border-gray-100 flex justify-end gap-4">
          <Link
            href="/transport"
            className="px-6 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={formState === "submitting"}
            className="inline-flex items-center px-6 py-2.5 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {formState === "submitting" ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Log Transport
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
