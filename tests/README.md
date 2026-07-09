# Cross-component tests

PrivyQ's integration coverage currently lives close to the components that own
the boundary being tested — this is deliberate and gives full end-to-end paths:

- **SDK ↔ core** — `sdk-python/tests/test_integration.py` builds and launches the
  real `privyqd` and drives `protect`/`access`/`verify`/deny/expired/key-gen over
  gRPC.
- **Gateway ↔ SDK ↔ core** — `gateway/tests/test_api.py` runs a real core and
  exercises the full REST flow (protect → access → verify → 403 denial → evidence
  log → key generation).
- **Postgres persistence** — `core-go/internal/storage/postgres_test.go` proves
  the evidence chain survives a restart and still verifies (run with
  `PRIVYQ_TEST_DB` set; skipped otherwise).

## Directories here

- `integration/` — reserved for multi-service integration scenarios that don't
  belong to a single component (ARCH §23.2).
- `e2e/` — reserved for Playwright end-to-end tests that drive the Next.js
  frontend through the full stack for the BP §25 demo scenario, including the
  tamper-detection walkthrough (tracked as **X3**).

Run the per-component suites via `make test` from the repo root.
