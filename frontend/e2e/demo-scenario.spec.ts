import { test, expect } from "@playwright/test";

/**
 * The medical-records flow (blueprint.md §25) driven end to end against the REAL
 * backend: create a protected record, then attempt access as different people.
 *
 *   1. Create   — protect a new patient record from the dashboard.
 *   2. Granted  — as the Doctor persona, request access → GRANTED, plaintext shown.
 *   3. Denied   — switch to the Nurse persona, request access → DENIED.
 *   4. Audit    — the evidence log shows the protect + both access decisions.
 *
 * This requires the gateway/core to be running (NEXT_PUBLIC_API_URL, default
 * http://localhost:8000). When the backend is offline (e.g. a frontend-only CI
 * job) the whole scenario is skipped rather than failing.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const NOTES = "Echo: mild LV hypertrophy. Plan: continue beta-blocker.";

test("§25 flow against the live core: create → doctor granted → nurse denied → audit", async ({
  page,
  request,
}) => {
  // Skip cleanly unless the backend is up AND the core is actually reachable
  // (a degraded gateway with an unreachable core cannot run this flow).
  let healthy = false;
  try {
    const res = await request.get(`${API_BASE}/api/v1/health`, { timeout: 3000 });
    if (res.ok()) {
      const body = await res.json();
      healthy = body?.status === "healthy" && body?.services?.core === "healthy";
    }
  } catch {
    healthy = false;
  }
  test.skip(!healthy, `no healthy core at ${API_BASE}`);

  // 1. Create a protected record from the dashboard (as the default Doctor).
  await page.goto("/");
  await page.getByPlaceholder("e.g. John Doe").fill("John Doe");
  await page.getByPlaceholder(/Echo: mild/).fill(NOTES);
  await page.getByRole("button", { name: /Protect record/i }).click();
  await expect(page.getByText(/Protected .John Doe/i)).toBeVisible({ timeout: 10000 });

  // 2. Open the record and request access as the Doctor → GRANTED.
  await page.goto("/records");
  await page.getByText("John Doe").first().click();
  await page.waitForURL(/\/record\//);
  await page.getByRole("button", { name: /Request access/i }).click();
  await expect(page.getByText("UNLOCKED", { exact: true })).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/beta-blocker/)).toBeVisible();

  // 3. Switch to the Nurse persona and request again → DENIED.
  await page.evaluate(() => localStorage.setItem("privyq.persona", "bello"));
  await page.reload({ waitUntil: "networkidle" });
  await page.getByRole("button", { name: /Request access/i }).click();
  await expect(page.getByText("DENIED", { exact: true }).first()).toBeVisible({ timeout: 8000 });
  await expect(page.getByText(/beta-blocker/)).toHaveCount(0);

  // 4. The evidence log records the protect + both access decisions.
  await page.goto("/audit");
  await expect(page.locator("h1")).toContainText("Evidence log");
  await expect(page.locator("tbody tr")).not.toHaveCount(0);
  await expect(page.getByText("granted").first()).toBeVisible();
  await expect(page.getByText("denied").first()).toBeVisible();
});
