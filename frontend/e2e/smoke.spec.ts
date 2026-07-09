import { test, expect, type ConsoleMessage } from "@playwright/test";

/**
 * Smoke test — every static app route loads and renders its <h1>, with no
 * uncaught page exceptions. The pages degrade gracefully when the gateway is
 * offline (they show "core offline" states), so the expected offline noise —
 * refused gateway fetches and the Google-Fonts <link> — is filtered out;
 * anything else (React errors, real JS exceptions) fails the test.
 */

const ROUTES: { path: string; heading: RegExp }[] = [
  { path: "/", heading: /Secure a patient record/ },
  { path: "/upload", heading: /New protected record/ },
  { path: "/records", heading: /Records/ },
  { path: "/audit", heading: /Evidence log/ },
  { path: "/keys", heading: /Keys/ },
  { path: "/playground", heading: /Policy playground/ },
];

/** Console-error text that is expected while the gateway/core is offline. */
const IGNORED_ERROR = [
  "localhost:8000",
  "ERR_CONNECTION_REFUSED",
  "ERR_NETWORK",
  "net::",
  "Failed to load resource",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
  "favicon.ico",
];

function isIgnorable(text: string): boolean {
  return IGNORED_ERROR.some((needle) => text.includes(needle));
}

for (const { path, heading } of ROUTES) {
  test(`route ${path} renders its heading without page errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error" && !isIgnorable(msg.text())) errors.push(msg.text());
    });
    page.on("pageerror", (err) => {
      if (!isIgnorable(err.message)) errors.push(err.message);
    });

    await page.goto(path, { waitUntil: "networkidle" });
    await expect(page.locator("h1")).toContainText(heading);
    expect(errors, `unexpected errors on ${path}:\n${errors.join("\n")}`).toEqual([]);
  });
}
