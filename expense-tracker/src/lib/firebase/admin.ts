import "server-only";

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { firebaseConfigSchema } from "./config";

const adminConfigSchema = firebaseConfigSchema(process.env.NODE_ENV === "production");

export class ConfigurationError extends Error {
  constructor() { super("Firebase configuration is missing or invalid."); this.name = "ConfigurationError"; }
}

/** Returns variable names only. Never return environment values to the browser. */
export function getConfigurationStatus(): { configured: boolean; missing: string[] } {
  const parsed = adminConfigSchema.safeParse(process.env);
  return parsed.success ? { configured: true, missing: [] } : {
    configured: false,
    missing: [...new Set(parsed.error.issues.map((issue) => issue.path.join(".")))],
  };
}

function getConfig() {
  const parsed = adminConfigSchema.safeParse(process.env);
  if (!parsed.success) throw new ConfigurationError();
  return parsed.data;
}

export function getAppOrigin(): string { return new URL(getConfig().APP_URL).origin; }

function getAdminApp() {
  const config = getConfig();
  const name = "davo-expense-tracker";
  const existing = getApps().find((app) => app.name === name);
  return existing ?? initializeApp({
    credential: cert({ projectId: config.FIREBASE_PROJECT_ID, clientEmail: config.FIREBASE_CLIENT_EMAIL, privateKey: config.FIREBASE_PRIVATE_KEY }),
    projectId: config.FIREBASE_PROJECT_ID,
  }, name);
}

/** Admin SDK bypasses Firestore rules. Call only behind fresh server authorization. */
export function getAdminDb() { return getFirestore(getAdminApp()); }
export function getAdminAuth() { return getAuth(getAdminApp()); }
