import { test, expect, type ConsoleMessage } from "@playwright/test";

/**
 * Smoke test — every one of the 7 app routes loads and renders its <h1> heading,
 * with no unexpected console errors or uncaught page exceptions.
 *
 * Runs against offline demo mode (no gateway). Expected offline noise — the
 * failed fetches to the gateway (http://localhost:8000) and the Google Fonts
 * <link> that cannot load without network — is filtered out; anything else
 * (React errors, real JS exceptions) fails the test.
 */

const ROUTES: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /Welcome,/ },
  { path: "/upload", heading: /Upload a patient record/ },
  { path: "/records", heading: /Protected records/ },
  { path: "/record/patient_001", heading: /John Doe/ },
  { path: "/audit", heading: /Evidence log/ },
  { path: "/keys", heading: /Key management/ },
  { path: "/playground", heading: /Policy playground/ },
];

/** Console-error text that is expected while the gateway/core is offline. */
const IGNORED_ERROR = [
  "localhost:8000", // gateway REST calls (health, evidence log) — refused offline
  "ERR_CONNECTION_REFUSED",
  "ERR_NETWORK",
  "ERR_INTERNET_DISCONNECTED",
  "ERR_NAME_NOT_RESOLVED",
  "net::",
  "Failed to load resource",
  "fonts.googleapis.com", // fonts loaded via <link>, may be unreachable offline
  "fonts.gstatic.com",
  "favicon.ico",
];

function isIgnorable(text: string): boolean {
  return IGNORED_ERROR.some((needle) => text.includes(needle));
}

for (const { path, heading } of ROUTES) {
  test(`route ${path} renders its heading without console errors`, async ({
    page,
  }) => {
    const errors: string[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error" && !isIgnorable(msg.text())) {
        errors.push(msg.text());
      }
    });
    page.on("pageerror", (err) => {
      if (!isIgnorable(err.message)) errors.push(err.message);
    });

    await page.goto(path, { waitUntil: "networkidle" });

    await expect(page.locator("h1")).toContainText(heading);

    expect(errors, `console errors on ${path}:\n${errors.join("\n")}`).toEqual(
      [],
    );
  });
}
