import { readFileSync } from "node:fs";
import { createPrivateKey } from "node:crypto";
import { parseEnv } from "node:util";
import { firebaseConfigSchema } from "../src/lib/firebase/config";

let raw: string;
try { raw = readFileSync(".env.local", "utf8"); }
catch { console.error("No .env.local found. Copy .env.example and configure it locally."); process.exit(1); }
const env = parseEnv(raw);
const parsed = firebaseConfigSchema(process.argv.includes("--production")).safeParse(env);
const keys = ["APP_URL", "NEXT_PUBLIC_FIREBASE_API_KEY", "NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", "NEXT_PUBLIC_FIREBASE_PROJECT_ID", "NEXT_PUBLIC_FIREBASE_APP_ID", "FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"];
for (const key of keys) console.log(`${key}: ${env[key] ? "set" : "not set"}`);
if (!parsed.success) {
  console.error(`Configuration needs attention: ${[...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))].join(", ")}. See docs/environment.md.`);
  process.exitCode = 1;
} else {
  try {
    createPrivateKey(parsed.data.FIREBASE_PRIVATE_KEY);
    console.log("Required configuration is valid; client/server project IDs match; private key parses. No remote connection was attempted.");
  } catch { console.error("FIREBASE_PRIVATE_KEY is not a valid private key."); process.exitCode = 1; }
}
const names = [...raw.matchAll(/^([A-Z][A-Z0-9_]*)=/gm)].map((match) => match[1]);
if (new Set(names).size !== names.length) { console.error("Duplicate environment variable names found; remove ambiguity before starting."); process.exitCode = 1; }
for (const group of [["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"], ["ATTACHMENT_PROVIDER"], ["CRON_SECRET"]]) {
  console.log(`Future integration (${group.join(", ")}): ${group.every((key) => env[key]) ? "values present; code not yet wired" : "not configured; not needed for foundation"}`);
}
