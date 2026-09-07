import "server-only";
import { createHash, randomInt } from "crypto";
import nodemailer from "nodemailer";

export const normalizeEmail = (email: string) => email.trim().toLowerCase();
export const resetKey = (email: string) => createHash("sha256").update(normalizeEmail(email)).digest("hex");
export const hashOtp = (email: string, otp: string) => createHash("sha256").update(`${normalizeEmail(email)}:${otp}`).digest("hex");
export const createOtp = () => String(randomInt(0, 1_000_000)).padStart(6, "0");

export async function sendResetOtp(email: string, otp: string) {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) throw new Error("Password-reset email is not configured.");
  const transporter = nodemailer.createTransport({ host, port: Number(process.env.SMTP_PORT || 465), secure: process.env.SMTP_SECURE !== "false", auth: { user, pass } });
  await transporter.sendMail({ from: process.env.SMTP_FROM || user, to: email, subject: "Your Davo Ads Manager password reset code", text: `Your password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`, html: `<div style="font-family:Arial,sans-serif;max-width:520px"><h2>Davo Ads Manager</h2><p>Use this code to reset your password:</p><p style="font-size:30px;font-weight:700;letter-spacing:7px">${otp}</p><p>This code expires in 10 minutes. If you did not request it, ignore this email.</p></div>` });
}
