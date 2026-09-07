import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: { baseURL: "http://localhost:3100", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", viewport: { width: 1440, height: 1100 } } },
    { name: "mobile", use: { ...devices["Desktop Chrome"], channel: process.env.PLAYWRIGHT_CHANNEL ?? "msedge", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } },
  ],
  webServer: {
    command: "npm run dev -- --port 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: false,
    timeout: 120_000,
    // Never let browser smoke tests contact a real Firebase project or expose local config.
    env: { DAVO_E2E: "1", APP_URL: "http://localhost:3100", FIREBASE_PROJECT_ID: "", FIREBASE_PRIVATE_KEY: "", FIREBASE_CLIENT_EMAIL: "", NEXT_PUBLIC_FIREBASE_API_KEY: "", NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: "", NEXT_PUBLIC_FIREBASE_PROJECT_ID: "", NEXT_PUBLIC_FIREBASE_APP_ID: "", NEXT_TELEMETRY_DISABLED: "1" },
  },
});
