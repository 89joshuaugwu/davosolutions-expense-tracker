"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Loader2, X } from "lucide-react";
import { useState, type FormEvent } from "react";
import { KeyRound } from "lucide-react";
import type { AppUser } from "@/types";

export function EditUserModal({
  user,
  onClose,
  onSave,
  onSendReset,
}: {
  user: AppUser | null;
  onClose: () => void;
  onSave: (id: string, updates: any) => Promise<void>;
  onSendReset?: (user: AppUser) => Promise<void>;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user) return;
    const form = new FormData(e.currentTarget);
    setLoading(true);
    setError(null);

    try {
      const updates: any = {};
      const displayName = String(form.get("displayName") ?? "").trim();
      const email = String(form.get("email") ?? "").trim().toLowerCase();
      const password = String(form.get("password") ?? "");
      const active = form.get("active") === "true";

      if (displayName && displayName !== user.displayName) {
        updates.displayName = displayName;
      }
      if (email && email !== user.email) {
        updates.email = email;
      }
      if (password) {
        if (password.length < 8) throw new Error("Password must be at least 8 characters");
        updates.password = password;
      }
      if (active !== user.active) {
        updates.active = active;
      }

      await onSave(user.id, updates);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputClass = "w-full rounded-xl border border-line px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-primary";

  return (
    <AnimatePresence>
      {user && (
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
              <h2 className="font-display text-lg font-bold text-ink">Edit User</h2>
              <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:bg-neutral-soft">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">Full Name</span>
                <input name="displayName" defaultValue={user.displayName} required className={inputClass} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">Login Email</span>
                <input name="email" type="email" defaultValue={user.email} required className={inputClass} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">New Password (Optional)</span>
                <input name="password" type="password" placeholder="Leave blank to keep current" minLength={8} className={inputClass} />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-ink-soft">Account Status</span>
                <select name="active" defaultValue={user.active ? "true" : "false"} className={inputClass}>
                  <option value="true">Active</option>
                  <option value="false">Inactive / Disabled</option>
                </select>
              </label>

              {error && <p className="text-sm text-danger">{error}</p>}

              {onSendReset && <button type="button" disabled={loading} onClick={async () => { setLoading(true); setError(null); try { await onSendReset(user); } catch (err) { setError(err instanceof Error ? err.message : "Unable to send the reset email"); } finally { setLoading(false); } }} className="flex w-full items-center justify-center gap-2 rounded-full border border-line py-3 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:opacity-60"><KeyRound size={16} /> Send password-reset email</button>}

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-white transition hover:bg-primary-hover disabled:opacity-60"
              >
                {loading && <Loader2 size={16} className="animate-spin" />}
                Save Changes
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
