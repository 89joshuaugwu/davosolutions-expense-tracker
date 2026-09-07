"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { createCard, updateCard } from "@/lib/firestore-helpers";
import type { BusinessAccount, Card } from "@/types";

export type CardModalMode = { card?: Card } | null;

const inputClass =
  "w-full rounded-xl border border-line px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary";

export function CardModal({
  mode,
  businessAccounts,
  onClose,
}: {
  mode: CardModalMode;
  businessAccounts: BusinessAccount[];
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const editing = mode?.card;
  const selectedBusinessIds = editing?.businessAccountIds ?? (editing?.businessAccountId ? [editing.businessAccountId] : []);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!mode) return;
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);

    try {
      const businessAccountIds = form.getAll("businessAccountIds").map(String);
      const selectedBusinesses = businessAccounts.filter((b) => businessAccountIds.includes(b.id));
      const lastFourDigits = String(form.get("lastFourDigits") ?? "").trim();

      if (!/^\d{4}$/.test(lastFourDigits)) {
        throw new Error("Last 4 digits must be exactly 4 numbers.");
      }

      const payload = {
        name: String(form.get("name") ?? "").trim(),
        lastFourDigits,
        businessAccountIds,
        businessNames: selectedBusinesses.map((business) => business.name),
        notes: String(form.get("notes") ?? "").trim(),
      };

      if (editing) {
        await updateCard(editing.id, {
          ...payload,
          status: (form.get("status") === "inactive" ? "inactive" : "active"),
        });
      } else {
        await createCard(payload);
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AnimatePresence>
      {mode && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-lg font-bold text-ink">
                {editing ? "Edit Card" : "Add Card"}
              </h2>
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-neutral-soft"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Card name
                </span>
                <input
                  name="name"
                  required
                  defaultValue={editing?.name}
                  placeholder="e.g. Access Bank Virtual Card 1"
                  className={inputClass}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Last 4 digits
                </span>
                <input
                  name="lastFourDigits"
                  required
                  maxLength={4}
                  inputMode="numeric"
                  pattern="\d{4}"
                  defaultValue={editing?.lastFourDigits}
                  placeholder="1234"
                  className={inputClass}
                />
              </label>

              <fieldset className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Linked business centres (optional)
                </span>
                <div className="max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line bg-canvas/40 p-2">
                  {businessAccounts.map((business) => <label key={business.id} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm text-ink transition hover:bg-white"><input name="businessAccountIds" type="checkbox" value={business.id} defaultChecked={selectedBusinessIds.includes(business.id)} className="h-4 w-4 rounded border-line text-primary focus:ring-primary" />{business.name}</label>)}
                  {!businessAccounts.length && <p className="px-2 py-2 text-sm text-ink-soft">No business centres are available yet.</p>}
                </div>
                <p className="mt-1.5 text-xs leading-5 text-ink-soft">Choose one or more business centres. Leave all unchecked to keep the card available for any business centre.</p>
              </fieldset>

              {editing && (
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                    Status
                  </span>
                  <select name="status" defaultValue={editing.status} className={inputClass}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              )}

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">
                  Notes (optional)
                </span>
                <textarea name="notes" rows={2} defaultValue={editing?.notes} className={inputClass} />
              </label>

              {error && <p className="text-sm text-danger">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Save
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
