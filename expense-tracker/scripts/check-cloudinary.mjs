#!/usr/bin/env node
// Read-only Admin API check of the exact configured upload preset. Never uploads or changes settings.
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";

try {
  const env = parseEnv(await readFile(".env.local", "utf8"));
  const names = ["CLOUDINARY_CLOUD_NAME", "CLOUDINARY_UPLOAD_PRESET", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET"];
  if (env.ATTACHMENT_PROVIDER !== "cloudinary" || names.some((name) => !env[name])) throw new Error("configuration");
  if (!/^[a-zA-Z0-9_-]+$/.test(env.CLOUDINARY_CLOUD_NAME)) throw new Error("configuration");
  const endpoint = `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/upload_presets/${encodeURIComponent(env.CLOUDINARY_UPLOAD_PRESET)}`;
  const response = await fetch(endpoint, {
    headers: { Authorization: `Basic ${Buffer.from(`${env.CLOUDINARY_API_KEY}:${env.CLOUDINARY_API_SECRET}`).toString("base64")}` },
    signal: AbortSignal.timeout(15_000),
    redirect: "error",
  });
  if (!response.ok) {
    console.error(`Cloudinary preset verification failed (HTTP ${response.status}). No remote settings or files changed. Check cloud name, API credentials and preset in the dashboard.`);
    process.exitCode = 1;
  } else {
    const preset = await response.json();
    console.log("Cloudinary credentials accepted and the configured upload preset exists. No files uploaded or settings changed.");
    console.log(`Preset mode: ${preset.unsigned === true ? "unsigned" : preset.unsigned === false ? "signed" : "not reported"}.`);
    console.log(`Preset authenticated delivery: ${preset.settings?.type === "authenticated" ? "enabled" : "not configured in preset; enforce in signed upload requests"}.`);
    if (preset.unsigned === true) console.log("Before enabling receipts, use a signed-only preset or disable unsigned uploads; the app must force authenticated delivery.");
    console.log("Actual image/PDF/document upload and private-download behavior still requires E4 integration testing.");
  }
} catch (error) {
  const kind = error instanceof Error && error.message === "configuration" ? "configuration is incomplete/invalid" : "request or local file access failed";
  console.error(`Cloudinary check: ${kind}. No credential values or raw provider errors are printed.`);
  process.exitCode = 1;
}
