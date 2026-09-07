import { z } from "zod";

/** Pure validation shared with local setup checks. Never serialize parsed values to the browser. */
export function firebaseConfigSchema(production: boolean) {
  return z.object({
    FIREBASE_PROJECT_ID: z.string().trim().min(1),
    FIREBASE_CLIENT_EMAIL: z.email(),
    FIREBASE_PRIVATE_KEY: z.string().min(1).transform((value) => value.replace(/\\n/g, "\n")).refine((value) => value.includes("-----BEGIN PRIVATE KEY-----")),
    APP_URL: z.url().refine((value) => {
      const url = new URL(value);
      return url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash &&
        (url.protocol === "https:" || (!production && url.protocol === "http:" && ["localhost", "127.0.0.1"].includes(url.hostname)));
    }),
    NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1),
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1),
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1),
    NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1),
    FIREBASE_AUTH_EMULATOR_HOST: z.string().optional(),
    FIRESTORE_EMULATOR_HOST: z.string().optional(),
    FIREBASE_STORAGE_EMULATOR_HOST: z.string().optional(),
  }).superRefine((value, context) => {
    if (value.FIREBASE_PROJECT_ID !== value.NEXT_PUBLIC_FIREBASE_PROJECT_ID) context.addIssue({ code: "custom", path: ["NEXT_PUBLIC_FIREBASE_PROJECT_ID"], message: "Client and server must use the same dedicated Firebase project." });
    if (production) for (const key of ["FIREBASE_AUTH_EMULATOR_HOST", "FIRESTORE_EMULATOR_HOST", "FIREBASE_STORAGE_EMULATOR_HOST"] as const) {
      if (value[key]) context.addIssue({ code: "custom", path: [key], message: "Emulators cannot be enabled in production." });
    }
  });
}
