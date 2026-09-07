"use client";

import { KeyRound, Loader2, Wallet, Plus, Trash2, Settings } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/context/AuthContext";
import { subscribePaymentMethods, createPaymentMethod, deletePaymentMethod, getGlobalSettings, updateGlobalSettings } from "@/lib/firestore-helpers";
import { encryptPassword } from "@/lib/vault";
import type { PaymentMethod, GlobalSettings } from "@/types";

export default function SettingsPage() {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => { if (!loading && !user) router.replace("/login"); }, [loading, user, router]);

  async function sendCode() {
    if (!user?.email) return;
    setSubmitting(true);
    setMessage("");
    try {
      await fetch("/api/auth/send-otp", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email }) });
      setCodeSent(true);
      setMessage("A six-digit verification code has been sent to your email.");
    } catch {
      setMessage("Unable to send the verification code right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function resetPassword() {
    if (!user?.email) return;
    setSubmitting(true); setMessage("");
    try {
      const response = await fetch("/api/auth/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: user.email, otp, password: newPassword }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage("Password updated successfully."); setOtp(""); setNewPassword(""); setCodeSent(false);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to reset the password.");
    } finally { setSubmitting(false); }
  }

  if (loading || !user) return <main className="flex min-h-screen items-center justify-center bg-navy"><Loader2 className="animate-spin text-white" /></main>;

  return <AppShell><div className="mx-auto max-w-2xl px-4 py-6 sm:px-6 sm:py-8">
    <p className="eyebrow">Account settings</p>
    <h1 className="mt-1 font-display text-2xl font-extrabold text-ink">Security</h1>
    <section className="app-surface mt-6 p-5 sm:p-6">
      <div className="flex items-start gap-3"><span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary"><KeyRound size={19} /></span><div><h2 className="font-display text-lg font-bold text-ink">Reset password</h2><p className="mt-1 text-sm leading-6 text-ink-soft">We will send a six-digit verification code to <span className="font-semibold text-ink">{user.email}</span>.</p></div></div>
      {!codeSent ? <button onClick={sendCode} disabled={submitting} className="mt-5 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Sending…" : "Send verification code"}</button> : <div className="mt-5 space-y-3"><input value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" placeholder="6-digit code" className="w-full rounded-xl border border-line px-3 py-2.5 text-center text-lg tracking-[0.3em] outline-none focus:border-primary" /><input value={newPassword} onChange={(event) => setNewPassword(event.target.value)} type="password" placeholder="New password (8+ characters)" className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-primary" /><div className="flex gap-2"><button onClick={resetPassword} disabled={submitting || otp.length !== 6 || newPassword.length < 8} className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white disabled:opacity-60">{submitting ? "Updating…" : "Update password"}</button><button onClick={sendCode} disabled={submitting} className="rounded-xl border border-line px-4 py-3 text-sm font-bold text-ink disabled:opacity-60">Resend code</button></div></div>}
      {message && <p className="mt-4 rounded-xl bg-canvas px-3 py-2.5 text-sm text-ink-soft">{message}</p>}
    </section>
    
    {profile?.role === "super_admin" && <GlobalSettingsSection />}
    {profile?.role !== "super_admin" && <PaymentMethodsSection />}
  </div></AppShell>;
}

function PaymentMethodsSection() {
  const { viewedWorkspaceId } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsub = subscribePaymentMethods((rows) => {
      setMethods(rows);
      setLoading(false);
    }, viewedWorkspaceId);
    return unsub;
  }, [viewedWorkspaceId]);

  const handleAdd = async () => {
    if (!title.trim() || !address.trim()) return;
    setSaving(true);
    setError("");
    try {
      const encryptedAddress = await encryptPassword(address.trim());
      await createPaymentMethod({ title: title.trim(), encryptedAddress });
      setTitle("");
      setAddress("");
    } catch (err: any) {
      setError(err.message || "Failed to add payment method");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm("Remove this payment method?")) {
      await deletePaymentMethod(id);
    }
  };

  if (loading) return null;

  return (
    <section className="app-surface mt-6 p-5 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Wallet size={19} />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Payment Methods</h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">
            Save your wallet addresses to receive funding. Addresses are securely encrypted in the database.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Title (e.g. USDT TRC20, Bank)</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. BTC Wallet"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <div className="flex-[2]">
            <label className="mb-1 block text-xs font-semibold text-ink-soft">Address or Account Details</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Your address"
              className="w-full rounded-xl border border-line px-3 py-2.5 text-sm outline-none focus:border-primary"
            />
          </div>
          <button
            onClick={handleAdd}
            disabled={saving || !title.trim() || !address.trim()}
            className="flex h-11 items-center gap-1.5 rounded-xl bg-primary px-4 font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-60 sm:h-[42px]"
          >
            <Plus size={16} /> {saving ? "Saving..." : "Add"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      </div>

      {methods.length > 0 && (
        <div className="mt-6 divide-y divide-line rounded-xl border border-line">
          {methods.map((method) => (
            <div key={method.id} className="flex items-center justify-between p-4">
              <div>
                <p className="font-semibold text-ink">{method.title}</p>
                <p className="text-xs text-ink-soft font-mono">•••••••• (Encrypted)</p>
              </div>
              <button
                onClick={() => handleDelete(method.id)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-soft transition hover:bg-danger/10 hover:text-danger"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function GlobalSettingsSection() {
  const [settings, setSettings] = useState<GlobalSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    getGlobalSettings().then(setSettings).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setSaving(true);
    setMessage("");
    try {
      await updateGlobalSettings({
        usdToNairaRate: Number(settings.usdToNairaRate),
        lowBalanceAlertEmail: settings.lowBalanceAlertEmail,
      });
      setMessage("Global settings updated.");
      setTimeout(() => setMessage(""), 3000);
    } catch (err: any) {
      setMessage(err.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return null;

  return (
    <section className="app-surface mt-6 p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary-soft text-primary">
          <Settings size={19} />
        </span>
        <div>
          <h2 className="font-display text-lg font-bold text-ink">Global Settings</h2>
          <p className="mt-1 text-sm leading-6 text-ink-soft">Platform-wide configuration and defaults.</p>
        </div>
      </div>
      <div className="mt-6 space-y-4 max-w-md">
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Global USD to Naira Exchange Rate</label>
          <input
            type="number"
            value={settings?.usdToNairaRate || 0}
            onChange={(e) => setSettings(s => s ? { ...s, usdToNairaRate: Number(e.target.value) } : null)}
            className="w-full rounded-xl border border-line bg-canvas/50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-ink-soft mb-1">Low Balance Alert Email</label>
          <input
            type="email"
            value={settings?.lowBalanceAlertEmail || ""}
            onChange={(e) => setSettings(s => s ? { ...s, lowBalanceAlertEmail: e.target.value } : null)}
            className="w-full rounded-xl border border-line bg-canvas/50 px-3 py-2.5 text-sm outline-none focus:border-primary focus:bg-white"
            placeholder="admin@davosolutions.com"
          />
        </div>
        <button
          disabled={saving}
          onClick={handleSave}
          className="rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition hover:-translate-y-0.5 hover:bg-primary-hover disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Settings"}
        </button>
        {message && <p className="text-sm font-medium text-success mt-2">{message}</p>}
      </div>
    </section>
  );
}
