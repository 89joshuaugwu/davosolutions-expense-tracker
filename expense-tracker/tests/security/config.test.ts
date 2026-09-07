import assert from "node:assert/strict";
import test from "node:test";
import { firebaseConfigSchema } from "../../src/lib/firebase/config";

const sample = { APP_URL: "http://localhost:3000", FIREBASE_PROJECT_ID: "demo-expenses", FIREBASE_CLIENT_EMAIL: "test@demo-expenses.iam.gserviceaccount.com", FIREBASE_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\\nfixture\\n-----END PRIVATE KEY-----", NEXT_PUBLIC_FIREBASE_API_KEY: "fixture", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "demo-expenses.firebaseapp.com", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "demo-expenses", NEXT_PUBLIC_FIREBASE_APP_ID: "fixture" };
test("configuration rejects mismatched projects and incomplete settings", () => {
  assert.equal(firebaseConfigSchema(false).safeParse(sample).success, true);
  assert.equal(firebaseConfigSchema(false).safeParse({ ...sample, NEXT_PUBLIC_FIREBASE_PROJECT_ID: "other-project" }).success, false);
  assert.equal(firebaseConfigSchema(false).safeParse({}).success, false);
});
test("production requires HTTPS origin without paths and disables emulators", () => {
  const schema = firebaseConfigSchema(true);
  assert.equal(schema.safeParse(sample).success, false);
  const production = { ...sample, APP_URL: "https://expenses.davosolutions.com" };
  assert.equal(schema.safeParse(production).success, true);
  for (const APP_URL of ["https://example.com/path", "https://user:password@example.com", "https://example.com?next=evil", "http://example.com"]) assert.equal(schema.safeParse({ ...production, APP_URL }).success, false);
  for (const key of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"]) assert.equal(schema.safeParse({ ...production, [key]: "localhost:8080" }).success, false);
});
