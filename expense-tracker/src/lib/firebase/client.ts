"use client";

import { getApps, initializeApp } from "firebase/app";
import { getAuth, inMemoryPersistence, sendPasswordResetEmail, setPersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";

function getClientAuth() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  };
  if (Object.values(config).some((value) => !value)) throw new Error("Login is unavailable until the project is configured.");
  const name = "davo-expense-tracker-client";
  return getAuth(getApps().find((app) => app.name === name) ?? initializeApp(config, name));
}

/** No Firebase token is persisted in browser storage; the server owns the session. */
export async function signIn(email: string, password: string): Promise<void> {
  const auth = getClientAuth();
  await setPersistence(auth, inMemoryPersistence);
  try {
    const credentials = await signInWithEmailAndPassword(auth, email, password);
    const idToken = await credentials.user.getIdToken();
    const response = await fetch("/api/auth/session", {
      method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) throw new Error(response.status === 503 ? "Login is temporarily unavailable." : "Unable to sign in. Check your account access or contact your administrator.");
  } catch {
    // Do not expose Firebase account-existence errors or credential details.
    throw new Error("Unable to sign in. Check your details and account access, then try again.");
  } finally {
    await signOut(auth);
  }
}

export async function resetPassword(email: string): Promise<void> {
  const auth = getClientAuth();
  try { await sendPasswordResetEmail(auth, email); }
  catch (error) {
    const code = (error as { code?: string }).code;
    if (code !== "auth/user-not-found") throw new Error("Unable to request a reset right now. Please try again later.");
  }
}

export async function signOutClient(): Promise<void> {
  const response = await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
  if (!response.ok) throw new Error("Unable to sign out. Please try again.");
  // signIn already clears SDK state, so logout does not need to initialize Firebase.
}
