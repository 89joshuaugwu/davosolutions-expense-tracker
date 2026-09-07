#!/usr/bin/env node
// Local-only configuration organizer. Never contacts Firebase or prints values.
import { readFile, writeFile, copyFile, access } from "node:fs/promises";
import path from "node:path";
import { parseArgs, parseEnv } from "node:util";

const { values } = parseArgs({ options: { "service-account": { type: "string" } }, strict: true });
const envPath = path.resolve(".env.local");
const raw = await readFile(envPath, "utf8").catch(() => "");
const existing = Object.fromEntries(Object.entries(parseEnv(raw)).filter(([key]) => /^[A-Z][A-Z0-9_]*$/.test(key)));
const configKeys = { apiKey: "NEXT_PUBLIC_FIREBASE_API_KEY", authDomain: "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", projectId: "NEXT_PUBLIC_FIREBASE_PROJECT_ID", appId: "NEXT_PUBLIC_FIREBASE_APP_ID", storageBucket: "FIREBASE_STORAGE_BUCKET" };
// Accept a Firebase web config object pasted into .env.local. Parse quoted literals only; never evaluate code.
for (const [property, key] of Object.entries(configKeys)) {
  const match = raw.match(new RegExp(`\\b${property}\\s*:\\s*["']([^"'\\r\\n]+)["']`));
  if (!existing[key] && match) existing[key] = match[1];
}
if (values["service-account"]) {
  const account = JSON.parse(await readFile(path.resolve(values["service-account"]), "utf8"));
  if (account.type !== "service_account" || !account.project_id || !account.client_email || !account.private_key) throw new Error("Expected a Firebase service-account JSON file.");
  if (existing.NEXT_PUBLIC_FIREBASE_PROJECT_ID && existing.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== account.project_id) throw new Error("Refusing to combine client and server credentials from different Firebase projects.");
  for (const [key, value] of Object.entries({ FIREBASE_PROJECT_ID: account.project_id, FIREBASE_CLIENT_EMAIL: account.client_email, FIREBASE_PRIVATE_KEY: account.private_key })) {
    if (existing[key] && existing[key].replace(/\\n/g, "\n") !== value) throw new Error(`Existing ${key} conflicts with the supplied file. Review locally.`);
    existing[key] = value;
  }
}
existing.APP_URL ||= "http://localhost:3000";
const groups = [
  ["Application origin. Set https://expenses.davosolutions.com in production.", ["APP_URL"]],
  ["Firebase web app identifiers (public). This expense app's dedicated project only.", ["NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_APP_ID"]],
  ["Firebase Admin credentials (SERVER ONLY). Never use a NEXT_PUBLIC_ prefix here.", ["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"]],
  ["Cloudinary selected for private images, PDFs and documents. Upload/download workflows pending; all credentials server-only.", ["ATTACHMENT_PROVIDER", "CLOUDINARY_CLOUD_NAME", "CLOUDINARY_UPLOAD_PRESET", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"]],
  ["Unused Firebase Storage bucket retained from web config. The app uses Cloudinary for attachments.", ["FIREBASE_STORAGE_BUCKET"]],
  ["Future bill-reminder email. Not wired yet. Port 465 uses SMTP_SECURE=true; 587 uses false with STARTTLS.", ["SMTP_HOST", "SMTP_PORT", "SMTP_SECURE", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]],
  ["Future authenticated scheduled job. Not wired yet. Generate a random server-only secret before deployment.", ["CRON_SECRET"]],
];
const grouped = new Set(groups.flatMap(([, keys]) => keys));
const encode = (value = "") => value ? JSON.stringify(value).replace(/\$/g, "\\$") : "";
const content = ["# Davo Expenses — local configuration. Ignored by Git; never commit or share.", "# See docs/environment.md for the source and purpose of each setting.", "", ...groups.flatMap(([comment, keys]) => [`# ${comment}`, ...keys.map((key) => `${key}=${encode(existing[key])}`), ""]), ...Object.entries(existing).filter(([key]) => !grouped.has(key)).map(([key, value]) => `${key}=${encode(value)}`), ""].join("\n");
if (raw) {
  try { await access(`${envPath}.before-setup`); }
  catch { await copyFile(envPath, `${envPath}.before-setup`); }
}
await writeFile(envPath, content, "utf8");
console.log("Organized .env.local. Original retained as ignored .env.local.before-setup. No values printed.");
for (const [, keys] of groups) for (const key of keys) console.log(`${key}: ${existing[key] ? "set" : "not set"}`);
