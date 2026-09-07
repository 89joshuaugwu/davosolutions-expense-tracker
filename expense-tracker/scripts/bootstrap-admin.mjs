#!/usr/bin/env node
// Run from expense-tracker. Reads only this app's explicit environment variables.
import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { parseArgs } from "node:util";

const { values } = parseArgs({
  options: { uid: { type: "string" }, project: { type: "string" }, apply: { type: "boolean", default: false } },
  strict: true,
});

async function main() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  if (!values.uid || values.uid.includes("/") || values.uid.length > 128 || !values.project) {
    throw new Error("Usage: npm run bootstrap:admin -- --uid FIREBASE_AUTH_UID --project DEDICATED_PROJECT_ID [--apply]");
  }
  if (!projectId || values.project !== projectId || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY) {
    throw new Error("Set this app's Firebase Admin environment variables and pass the matching --project.");
  }
  if (process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID !== projectId) {
    throw new Error("Client and server Firebase projects do not match.");
  }
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST || process.env.FIRESTORE_EMULATOR_HOST) {
    throw new Error("Bootstrap is for the explicitly named real project. Use a separate fixture script for emulators.");
  }
  const app = initializeApp({ projectId, credential: cert({
    projectId, clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }) }, "davo-expenses-bootstrap");
  const account = await getAuth(app).getUser(values.uid);
  if (account.disabled || !account.email) throw new Error("The target must be an existing, enabled Firebase Auth account with an email.");
  const db = getFirestore(app);
  const controlRef = db.collection("settings").doc("bootstrap");
  const userRef = db.collection("users").doc(account.uid);
  const auditRef = db.collection("auditLogs").doc();
  const profile = {
    uid: account.uid, name: account.displayName?.trim() || account.email.split("@")[0], email: account.email,
    role: "super_admin", status: "active",
    permissions: { viewSalaries: true, viewTransport: true, viewBills: true, viewOperationalTotals: true },
  };
  await db.runTransaction(async (transaction) => {
    const control = await transaction.get(controlRef);
    const user = await transaction.get(userRef);
    const admins = await transaction.get(db.collection("users").where("role", "==", "super_admin").limit(1));
    if (control.exists || !admins.empty) throw new Error("Bootstrap already completed or a Super Admin exists. Manage subsequent roles through the application.");
    if (user.exists) throw new Error("The target already has a profile. Bootstrap will not overwrite an existing user.");
    if (!values.apply) return;
    transaction.create(userRef, { ...profile, createdAt: FieldValue.serverTimestamp() });
    transaction.create(controlRef, { initialAdminUid: account.uid, createdAt: FieldValue.serverTimestamp() });
    transaction.create(auditRef, {
      action: "user.bootstrap", actor: { uid: "bootstrap-cli", role: "system" }, target: { collection: "users", id: account.uid },
      after: profile, reason: "Explicit first administrator bootstrap for the dedicated expenses project.", timestamp: FieldValue.serverTimestamp(),
    });
  });
  console.log(JSON.stringify({ mode: values.apply ? "created" : "dry-run", projectId, uid: account.uid, role: "super_admin" }));
  if (!values.apply) console.log("Checks passed. Re-run the same command with --apply to create the initial administrator and audit entry atomically.");
}

try { await main(); }
catch (error) {
  // Firebase errors may contain request details. Print only safe locally-authored messages.
  const known = error instanceof Error && !error.code && !error.message.includes("private_key");
  console.error(known ? error.message : "Bootstrap failed. Check the dedicated project, UID, credentials, account status, and Firestore access.");
  process.exitCode = 1;
}
