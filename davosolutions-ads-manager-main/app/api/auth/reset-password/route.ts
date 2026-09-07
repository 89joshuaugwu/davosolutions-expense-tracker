import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { hashOtp, normalizeEmail, resetKey } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json(); const email = typeof body.email === "string" ? normalizeEmail(body.email) : ""; const otp = typeof body.otp === "string" ? body.otp.trim() : ""; const password = typeof body.password === "string" ? body.password : "";
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^\d{6}$/.test(otp) || password.length < 8) return NextResponse.json({ error: "Enter a valid code and a password of at least 8 characters." }, { status: 400 });
    const db = getAdminDb(); const ref = db.collection("passwordResets").doc(resetKey(email)); const reset = await ref.get(); const data = reset.data();
    if (!reset.exists || !data || Date.now() > data.expiresAt || data.attempts >= 5 || data.otpHash !== hashOtp(email, otp)) { if (reset.exists) await ref.set({ attempts: Number(data?.attempts || 0) + 1 }, { merge: true }); return NextResponse.json({ error: "This code is invalid or expired." }, { status: 400 }); }
    const user = await getAdminAuth().getUserByEmail(email); await getAdminAuth().updateUser(user.uid, { password }); await ref.delete();
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Unable to reset the password." }, { status: 400 }); }
}
