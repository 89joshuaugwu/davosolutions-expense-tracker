import { NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebaseAdmin";
import { getGlobalSettings } from "@/lib/firestore-helpers";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const tokenStr = authHeader.split("Bearer ")[1];
    if (!tokenStr) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const decodedToken = await getAdminAuth().verifyIdToken(tokenStr);
    
    if (!decodedToken.uid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { subAdminEmail, subAdminName, availableBalanceNaira } = await req.json();

    if (!subAdminEmail || availableBalanceNaira === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const settings = await getGlobalSettings();
    const alertEmail = settings.lowBalanceAlertEmail;

    if (!alertEmail) {
      return NextResponse.json({ success: true, message: "No alert email configured." });
    }

    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      console.warn("SMTP not configured for low balance alert.");
      return NextResponse.json({ error: "SMTP not configured" }, { status: 500 });
    }

    const transporter = nodemailer.createTransport({ 
      host, 
      port: Number(process.env.SMTP_PORT || 465), 
      secure: process.env.SMTP_SECURE !== "false", 
      auth: { user, pass } 
    });

    const isNegative = availableBalanceNaira < 0;
    const subject = `[Alert] Low Funding Balance - ${subAdminName || subAdminEmail}`;
    const text = `Sub-admin ${subAdminName || subAdminEmail} currently has a ${isNegative ? 'negative' : 'low'} balance.\n\nAvailable Balance: ₦${availableBalanceNaira.toLocaleString()}\n\nPlease review their account and fund them if necessary.`;
    const html = `<div style="font-family:Arial,sans-serif;max-width:520px">
      <h2>Davo Ads Manager - Funding Alert</h2>
      <p>Sub-admin <strong>${subAdminName || subAdminEmail}</strong> currently has a <strong style="color: ${isNegative ? 'red' : 'orange'}">${isNegative ? 'negative' : 'low'}</strong> balance.</p>
      <p style="font-size: 24px; font-weight: bold; color: ${isNegative ? 'red' : 'orange'};">Available Balance: ₦${availableBalanceNaira.toLocaleString()}</p>
      <p>Please review their account and fund them if necessary.</p>
    </div>`;

    await transporter.sendMail({ 
      from: process.env.SMTP_FROM || user, 
      to: alertEmail, 
      subject, 
      text, 
      html 
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error in notify-low-balance:", error);
    return NextResponse.json({ error: error.message || "Internal server error" }, { status: 500 });
  }
}
