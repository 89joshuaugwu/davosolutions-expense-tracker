import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { createOtp, hashOtp, normalizeEmail, resetKey, sendResetOtp } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  const generic = NextResponse.json({ ok: true, message: "If an account exists, a reset code has been sent." });
  try {
    const { email: rawEmail } = await request.json(); const email = typeof rawEmail === "string" ? normalizeEmail(rawEmail) : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return generic;
    const db = getAdminDb(); const ref = db.collection("passwordResets").doc(resetKey(email)); const now = Date.now(); const previous = await ref.get();
    if (previous.exists && now - Number(previous.data()?.lastSentAt || 0) < 60_000) return generic;
    try { await getAdminAuth().getUserByEmail(email); } catch { return generic; }
    const otp = createOtp(); await ref.set({ email, otpHash: hashOtp(email, otp), expiresAt: now + 10 * 60_000, attempts: 0, lastSentAt: now, createdAt: now });
    await sendResetOtp(email, otp);
  } catch { /* Deliberately keep the response generic to prevent account enumeration. */ }
  return generic;
}
