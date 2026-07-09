import { test, expect } from "@playwright/test";

/**
 * The medical-records demo scenario (blueprint.md §25) driven end to end through
 * the UI in offline demo mode:
 *
 *   1. Authorized access  — as the Doctor persona (Dr. Amara Okafor), request
 *      access to a protected cardiology record → GRANTED, vault unlocks, the
 *      plaintext is revealed.
 *   2. Unauthorized access — switch the header role switcher to the Nurse persona
 *      (Nurse Bello Musa) and request again → DENIED, the vault stays locked and
 *      no plaintext is shown.
 *   3. Audit verification  — on /audit, verify a signed, hash-chained evidence
 *      entry → all checks green.
 *   4. Tamper detection (§25.4) — apply a tamper simulation (edit signature) and
 *      re-verify → verification fails, tampering is detected.
 *
 * `record.plaintext` for patient_001 contains "continue beta-blocker" — we use
 * that string as the tell-tale for whether the record was actually decrypted.
 */

const PLAINTEXT_TELL = /continue beta-blocker/i;

test("BP §25 flow: doctor granted, nurse denied, audit verifies, tamper fails", async ({
  page,
}) => {
  // ── 1. Authorized access — Doctor persona (the default) ──────────────────
  await page.goto("/record/patient_001");
  await expect(page.locator("h1")).toContainText("John Doe");

  // Default acting persona is the Doctor.
  await expect(page.getByLabel("Acting as persona")).toHaveValue("amara");

  await page.getByRole("button", { name: "Request access" }).click();

  // Granted: verdict flips, the vault reports "unlocked", plaintext is revealed.
  await expect(page.getByRole("status")).toContainText("Access granted");
  await expect(page.getByText("unlocked", { exact: true })).toBeVisible();
  await expect(page.getByText(PLAINTEXT_TELL)).toBeVisible();

  // ── 2. Unauthorized access — switch to the Nurse persona ─────────────────
  await page.getByLabel("Acting as persona").selectOption("bello");

  // Switching persona resets the card back to the locked / idle state.
  await expect(page.getByText(PLAINTEXT_TELL)).toHaveCount(0);

  await page.getByRole("button", { name: "Request access" }).click();

  // Denied: verdict says denied, the vault stays locked, no plaintext leaks.
  await expect(page.getByRole("status")).toContainText("Denied");
  await expect(page.getByText("locked", { exact: true })).toBeVisible();
  await expect(page.getByText("unlocked", { exact: true })).toHaveCount(0);
  await expect(page.getByText(PLAINTEXT_TELL)).toHaveCount(0);

  // ── 3. Audit verification — a genuine entry verifies cleanly ─────────────
  await page.goto("/audit");
  await expect(page.locator("h1")).toContainText("Evidence log");

  await page.getByRole("button", { name: "Verify evidence" }).click();
  await expect(
    page.getByText("Verified — access was policy-compliant"),
  ).toBeVisible();

  // ── 4. Tamper detection (§25.4) — editing the signature breaks it ────────
  await page.getByRole("button", { name: "Edit signature" }).click();
  await page.getByRole("button", { name: "Verify evidence" }).click();

  await expect(
    page.getByText("Verification failed — tampering detected"),
  ).toBeVisible();
  // The "Verified" state must no longer be shown.
  await expect(
    page.getByText("Verified — access was policy-compliant"),
  ).toHaveCount(0);
});
