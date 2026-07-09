# End-to-end tests (Playwright) — task X3

Playwright specs that drive the PrivyQ frontend in its **offline demo mode** (no
FastAPI gateway / Go core running). Every `services/api.ts` call fails fast with
`CoreOfflineError`, so the UI falls back to the seeded data in `lib/demo-data.ts`
— which is exactly the state these specs exercise.

## Running

```bash
cd frontend
npm install                 # installs @playwright/test (a devDependency)
npx playwright install chromium   # one-time browser download (chromium only)
npm run test:e2e            # === npx playwright test
```

`playwright.config.ts` owns the app lifecycle via `webServer`: it runs
`npm run build && next start -p 3100` and points the tests at
`http://localhost:3100`. Nothing else needs to be started by hand.

Useful variants:

- `REUSE_E2E_SERVER=1 npm run test:e2e` — skip the build and reuse an
  already-running server on the port (e.g. `npm run dev -- -p 3100`).
- `E2E_PORT=4000 npm run test:e2e` — use a different port.

## Specs

- **`smoke.spec.ts`** — all 7 routes (`/`, `/upload`, `/records`,
  `/record/patient_001`, `/audit`, `/keys`, `/playground`) load and render their
  `<h1>` heading with no unexpected console errors. Expected offline noise (the
  refused gateway fetches to `localhost:8000` and the Google-Fonts `<link>`) is
  filtered out; anything else fails the test.
- **`demo-scenario.spec.ts`** — the medical-records walkthrough from
  `docs/blueprint.md` §25 / §25.4:
  1. Doctor persona requests access to `patient_001` → **granted**, vault
     unlocks, plaintext revealed.
  2. Header role switcher → Nurse persona, request again → **denied**, vault
     stays locked, no plaintext leaks.
  3. `/audit` verifies a signed, hash-chained evidence entry → all checks green.
  4. Tamper simulation (edit signature) + re-verify → **verification fails**,
     tampering detected.

## Notes

- The specs run with `contextOptions.reducedMotion: "reduce"`, which makes the
  demo's reveal / type-out animations short-circuit to 0 ms — fast and
  deterministic.
- `tsconfig.json` excludes `e2e/` and `playwright.config.ts` so `next build`
  never type-checks the test tooling (they are transpiled by Playwright itself).
- The offline policy mirror (`lib/policy.ts`) now resolves resource-scoped
  conditions (`classification`) against the record's attributes, so the
  documented §25 flow — Doctor granted, Nurse denied on `patient_001` — is
  reproducible offline. It remains a non-authoritative demo mirror; real policy
  evaluation happens only in the Go core.
