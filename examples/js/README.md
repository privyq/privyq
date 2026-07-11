# PrivyQ v2 — JavaScript/TypeScript examples

The same scenarios as `examples/python/`, via `@privyq/sdk` over the gateway REST API.

```bash
npm --prefix ../../sdk-js install && npm --prefix ../../sdk-js run build
npm install                                  # links @privyq/sdk (file:../../sdk-js)
# start the stack (core + gateway), then:
PRIVYQ_GATEWAY_URL=http://localhost:8000 node 01_pdp_check.mjs
PRIVYQ_GATEWAY_URL=http://localhost:8000 node 02_seal_and_compliance.mjs
```

- **01_pdp_check.mjs** — `check()` as a Policy-Decision point (banking approval-limit + break-glass).
- **02_seal_and_compliance.mjs** — protect/check/access, `seal()`/`verify()`, PDF evidence export.

Both are verified end-to-end against a live gateway.
