import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the PrivyQ frontend end-to-end tests (task X3).
 *
 * The app is driven entirely in its OFFLINE DEMO MODE: no FastAPI gateway / Go
 * core is running, so every `services/api.ts` call fails fast with
 * `CoreOfflineError` and the UI falls back to the seeded data in
 * `lib/demo-data.ts` (see `frontend/README.md`). That is exactly the state these
 * specs exercise.
 *
 * `webServer` builds and serves the production app on PORT so the tests run
 * against the same output as `npm run start`. Set REUSE_E2E_SERVER=1 to reuse an
 * already-running dev/prod server (e.g. `npm run dev`) for faster local runs.
 */

const PORT = Number(process.env.E2E_PORT ?? 3100);
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"]],
  timeout: 30_000,
  expect: { timeout: 15_000 },

  use: {
    baseURL,
    headless: true,
    // Animations in the demo (condition reveal, plaintext type-out) short-circuit
    // to 0ms under reduced motion — keeps the flows fast and deterministic.
    contextOptions: { reducedMotion: "reduce" },
    trace: "on-first-retry",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: process.env.REUSE_E2E_SERVER
      ? `npx next start -p ${PORT}`
      : `npm run build && npx next start -p ${PORT}`,
    url: baseURL,
    timeout: 180_000,
    reuseExistingServer: !process.env.CI,
    // Default NEXT_PUBLIC_API_URL (http://localhost:8000) is unreachable here,
    // which is what puts the app into offline demo mode.
    env: { NODE_ENV: "production" },
  },
});
