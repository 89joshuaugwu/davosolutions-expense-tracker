import { expect, test } from "@playwright/test";

test("unconfigured login stays honest and protected routes redirect", async ({ page, request }) => {
  for (const route of ["/dashboard", "/revenue", "/monthly-funds", "/reports", "/expenses/new", "/salaries/new"]) {
    const response = await request.get(route, { maxRedirects: 0 });
    expect([307, 308]).toContain(response.status());
    expect(response.headers().location).toContain("/login");
  }
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in to your workspace" })).toBeDisabled();
  await expect(page.getByText("Sign-in will be available", { exact: false })).toBeVisible();
  const response = await request.post("/api/auth/session", { data: { idToken: "forged" }, headers: { Origin: "https://untrusted.example" } });
  expect(response.ok()).toBe(false);
  expect(response.headers()["set-cookie"]).toBeUndefined();
});

test("admin preview renders consistent KPIs and switches reporting months", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/preview");
  await expect(page.getByRole("heading", { name: "Financial overview." })).toBeVisible();
  await expect(page.locator('.financial-chart svg[role="application"]')).toBeVisible();
  await expect(page.locator(".financial-chart .recharts-area-curve")).toHaveCount(3);
  await expect(page.locator(".metric-value")).toHaveText(["₦4,850,000", "₦1,820,000", "₦3,030,000", "₦5,430,000"]);
  await page.getByLabel("Reporting month").selectOption("2026-08");
  await expect(page.locator(".metric-value").first()).toHaveText("₦4,200,000");
  await page.getByLabel("Reporting month").selectOption("2026-07");
  await expect(page.getByText("Not set", { exact: true })).toBeVisible();
  await expect(page.getByText("N/A margin")).toBeVisible();
  expect(errors).toEqual([]);
});

test("secretary preview omits management values and other people's records", async ({ page }) => {
  await page.goto("/preview?role=secretary&section=revenue");
  await expect(page.getByRole("heading", { name: "A good day to stay on track." })).toBeVisible();
  await expect(page.locator(".metric-value")).toHaveCount(0);
  await expect(page.locator(".nav-link").filter({ hasText: "Revenue" })).toHaveCount(0);
  await expect(page.getByText("September salary payment")).toHaveCount(0);
  await expect(page.getByText("Amara Okafor", { exact: true })).not.toHaveCount(0);
  await expect(page.locator(".expense-table tbody tr")).toHaveCount(2);
});

test("expense search, category filter and accessible detail dialog work", async ({ page }) => {
  await page.goto("/preview?section=expenses");
  await page.getByLabel("Search expenses").fill("software");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Design software license" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText("USD 30 at a saved rate", { exact: false })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.getByLabel("Search expenses").fill("");
  await page.getByLabel("Filter by category").selectOption("Transportation");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByLabel("Search expenses").fill("no-such-record");
  await expect(page.getByRole("heading", { name: "No matching expenses" })).toBeVisible();
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(5);
});

test("responsive shell contains content and mobile navigation opens", async ({ page }, testInfo) => {
  await page.goto("/preview");
  await expect(page.locator('.financial-chart svg[role="application"]')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("dashboard.png"), fullPage: true });
  if (testInfo.project.name === "mobile") {
    await page.getByRole("button", { name: "Open navigation" }).click();
    await expect(page.getByRole("link", { name: "Expenses", exact: true })).toBeVisible();
    await page.getByRole("link", { name: "Expenses", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Small details. Clear records." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open navigation" })).toHaveAttribute("aria-expanded", "false");
  }
  await page.screenshot({ path: testInfo.outputPath("preview.png"), fullPage: true });
});
