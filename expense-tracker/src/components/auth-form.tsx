"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, CheckCircle2, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { resetPassword, signIn } from "@/lib/firebase/client";

export function AuthForm({ configured, reset = false }: { configured: boolean; reset?: boolean }) {
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured || busy) return;
    const data = new FormData(event.currentTarget);
    setBusy(true); setError("");
    try {
      const email = String(data.get("email") ?? "").trim();
      if (reset) { await resetPassword(email); setSent(true); }
      else {
        await signIn(email, String(data.get("password") ?? ""));
        // Start a fresh document after a new session; discard pre-login router state.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign("/dashboard");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Please try again."); }
    finally { setBusy(false); }
  }
  if (sent) return <div className="auth-success" role="status"><CheckCircle2 size={32} /><h2>Check your inbox</h2><p>If an account exists for that email, you’ll receive a password reset link.</p><Link className="button secondary" href="/login"><ArrowLeft size={16} /> Back to sign in</Link></div>;
  return <form className="auth-form" onSubmit={submit}>
    {!configured && <div className="notice"><LockKeyhole size={18} /><p>Sign-in will be available when your administrator connects this app’s Firebase project. You can explore the preview below.</p></div>}
    <label className="field-label" htmlFor="email">Work email</label><div className="input-icon"><Mail size={18} /><input id="email" name="email" type="email" placeholder="you@davosolutions.com" autoComplete="email" required maxLength={254} disabled={!configured || busy} /></div>
    {!reset && <><div className="label-row"><label className="field-label" htmlFor="password">Password</label><Link href="/forgot-password">Forgot password?</Link></div><div className="input-icon"><LockKeyhole size={18} /><input id="password" name="password" type={showPassword ? "text" : "password"} placeholder="Enter your password" autoComplete="current-password" required maxLength={128} disabled={!configured || busy} /><button type="button" aria-label={showPassword ? "Hide password" : "Show password"} aria-pressed={showPassword} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></div></>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="button primary auth-submit" disabled={!configured || busy}>{busy ? <LoaderCircle className="spin" size={18} /> : <>{reset ? "Send reset link" : "Sign in to your workspace"}<ArrowRight size={17} /></>}</button>
    <p className="auth-help">{reset ? "Remember your password? " : "Access is by invitation. Need an account? "}{reset ? <Link href="/login">Sign in</Link> : "Contact your administrator."}</p>
  </form>;
}
