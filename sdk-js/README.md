# PrivyQ TypeScript/JavaScript SDK (`@privyq/sdk`)

The developer-facing interface to PrivyQ for Node and the browser. It hides all
cryptographic and transport detail behind an **intention-based verb vocabulary**
— `protect`, `access`, `check`, `explain`, `seal`, `verify`, plus `evidence.*`
and key management — so you think in terms of *business intent* (protect this
record, may this identity access it, prove access was compliant), not
primitives. It is a peer of the [Python SDK](../sdk-python), not a stub: every
verb, type, and error the Python SDK exposes has a camelCase equivalent here.

- **No runtime dependencies.** Uses the platform `fetch`, `TextEncoder`, and
  base64 globals present in Node 18+ and every modern browser.
- **Runs everywhere.** Ships ESM + CommonJS + `.d.ts`; works in Node backends,
  serverless, and the browser.
- **Zero crypto in the client.** All cryptography and policy evaluation happen in
  the Go core; the SDK is a typed REST client for the PrivyQ gateway. This is the
  honesty invariant — the SDK never fakes a result it cannot get from the core.

> Status: **v2 line, first release (`0.1.0`)**. Feature-complete against the
> gateway's REST surface — including seal verification and wallet/DID identity
> verification. See [Gateway gaps](#gateway-gaps) for the one remaining minor
> difference from the Python SDK.

## Where it fits

```
Your app  ──▶  @privyq/sdk  ──HTTPS/REST──▶  FastAPI gateway  ──gRPC──▶  Go core  ──▶  liboqs/CIRCL
 (Node or browser)   (this package)        (auth, rate limit)      (all crypto, policy, audit)
```

The SDK speaks the gateway's OpenAPI contract (`docs/api/openapi.json`). See
[`docs/SYSTEM_ARCHITECTURE.md`](../docs/SYSTEM_ARCHITECTURE.md) for the full
picture and [`docs/v2_blueprint.md` §16](../docs/v2_blueprint.md) for this SDK's
specification.

## Install

```bash
npm install @privyq/sdk
# or: pnpm add @privyq/sdk   /   yarn add @privyq/sdk
```

**Prerequisites**

- Node **18+** (for global `fetch`), or a browser. On Node < 18, pass a `fetch`
  polyfill via `configure({ fetch })`.
- A running **PrivyQ gateway** (default `http://localhost:8000`). No liboqs or Go
  toolchain is needed on the client — the gateway/core own all cryptography.

## Quickstart (Node)

```ts
import { configure, protect, access, check, explain } from "@privyq/sdk";

configure({ gatewayUrl: "http://localhost:8000", apiKey: process.env.PRIVYQ_API_KEY });

// Encrypt data and embed its policy in one call.
const record = await protect("Patient: John Doe. Plan: continue beta-blocker.", {
  role: "doctor", department: "cardiology", purpose: "treatment", expiry: "24h",
});

// A pure authorization decision — no data revealed.
const decision = await check({ role: "nurse" }, record);
if (!decision.allowed) console.log(explain(decision)); // -> the policy reason

// Authorize + reveal. Throws AccessDenied (with .reason) if the policy denies.
const opened = await access(record, { role: "doctor", department: "cardiology" },
                            { purpose: "treatment" });
console.log(opened.text());              // -> "Patient: John Doe. ..."
console.log(opened.evidence.evidenceId); // a signed, verifiable access receipt
```

## Quickstart (browser)

The same package works unchanged in the browser — it uses `window.fetch`. Point
it at a gateway that permits your origin (the gateway sets permissive CORS by
default). **Never ship a privileged API key to the browser**; use a per-user
bearer token minted by your backend.

```ts
import { configure, check, explain } from "@privyq/sdk";

configure({ gatewayUrl: "https://api.privyq.example", token: userJwt });

const decision = await check(currentUser, invoiceEnvelope, { purpose: "approval" });
if (!decision.allowed) showToast(explain(decision));
```

## Worked example — medical records (blueprint §25)

```ts
import { configure, protect, access, check, explain, seal, verify, evidence, AccessDenied } from "@privyq/sdk";

configure({ gatewayUrl: "http://localhost:8000" });

// 1. Protect a record; the access rules travel inside the ciphertext.
const record = await protect(
  "Patient: John Doe. Plan: continue beta-blocker.",
  { role: "doctor", department: "cardiology", purpose: "treatment", expiry: "24h" },
  { actor: { user_id: "dr_smith", role: "doctor", department: "cardiology" } },
);

// 2. A nurse is denied — an explained decision, no plaintext.
const nurse = await check({ role: "nurse", department: "cardiology" }, record);
// Decision { allowed: false, reason: "…", failed: ["role"], matched: ["department"] }
console.log(explain(nurse));

// 3. The treating doctor opens it.
try {
  const opened = await access(record, { role: "doctor", department: "cardiology" },
                              { purpose: "treatment" });
  console.log(opened.text());
} catch (err) {
  if (err instanceof AccessDenied) console.error("denied:", err.reason);
  else throw err;
}

// 4. Post-quantum signature over a discharge summary.
const sealed = await seal("Discharge: stable, follow-up in 2 weeks.");

// 5. The tamper-evident audit trail, and a chain-integrity check.
const trail = await evidence.of(record.resourceId);
const chain = await evidence.verify({ resourceId: record.resourceId });
console.log(`${trail.length} entries, chain intact: ${chain.ok}`);

// 6. Verify one access receipt's signature + chain position cryptographically.
const receiptOk = await verify(opened.evidence);
console.log("receipt verified:", receiptOk.ok, receiptOk.signatureValid);
```

A runnable version is in [`examples/medical-records.mjs`](examples/medical-records.mjs)
(run `npm run build` first, then `node examples/medical-records.mjs` against a
live gateway).

## API surface

| Verb | Signature | REST route |
|------|-----------|------------|
| `configure` | `configure(options) → PrivyQConfig` | — (local) |
| `protect` | `protect(data, policy?, opts?) → ProtectedData` | `POST /api/v1/protect` |
| `access` | `access(protected, identity, opts?) → AccessResult` | `POST /api/v1/access` |
| `check` | `check(identity, resourceOrPolicy, opts?) → Decision` | `POST /api/v1/check` |
| `explain` | `explain(decision) → string` | — (local, sugar over `decision.reason`) |
| `seal` | `seal(data, opts?) → Sealed` | `POST /api/v1/seal` |
| `verify` | `verify(evidenceOrSealed, opts?) → VerificationResult` | `POST /api/v1/verify` (evidence) · `POST /api/v1/verify/seal` (seal) |
| `evidence.of` | `evidence.of(resourceId) → Evidence[]` | `GET /api/v1/evidence/log` |
| `evidence.log` | `evidence.log(filters?) → EvidenceLog` | `GET /api/v1/evidence/log` |
| `evidence.verify` | `evidence.verify(filters?) → VerificationResult` | `GET /api/v1/evidence/log` (chain) |
| `evidence.export` | `evidence.export(format, filters?) → Uint8Array` | `GET /api/v1/evidence/export` |
| `evidence.complianceReport` | `complianceReport(filters?) → object` | `GET /api/v1/compliance/report` |
| `generateKey` | `generateKey(opts?) → KeyInfo` | `POST /api/v1/keys/generate` |
| `getKey` | `getKey(keyId) → KeyInfo` | `GET /api/v1/keys/{id}` |
| `listKeys` | `listKeys() → KeyInfo[]` | `GET /api/v1/keys` |
| `rotateKey` | `rotateKey(keyId, opts?)` | `POST /api/v1/keys/rotate/{id}` |
| `revokeKey` | `revokeKey(keyId, opts?)` | `POST /api/v1/keys/revoke/{id}` |
| `verifyWallet` | `verifyWallet({ scheme?, publicKey, challenge, signature }) → WalletVerification` | `POST /api/v1/identity/wallet` |
| `health` | `health() → Health` | `GET /api/v1/health` |

**Policies** accept the same two forms as the Python SDK: *shorthand* (a flat map
where each key is a condition, e.g. `{ role: "doctor", department: ["cardiology"],
expiry: "24h" }`) or *structured* (`{ conditions: [...], combination: "all",
obligations: [...] }`). The core normalizes and enforces them.

### Errors

Every non-2xx response and network failure maps to a typed error extending
`PrivyQError`, so you catch intent, not status codes:

| HTTP | Error |
|------|-------|
| 401 | `AuthenticationError` |
| 403 | `AccessDenied` (has `.reason`, the policy denial message) |
| 404 | `KeyNotFoundError` |
| 409 | `KeyRevokedError` |
| 422 | `RequestValidationError` |
| 429 | `RateLimitedError` |
| 500 | `CryptoError` |
| 503 | `CoreUnavailableError` |
| network / DNS | `CoreUnavailableError` |
| timeout | `TimeoutError` |

`AccessDenied`, `PolicyViolationError`, `ConditionFailedError`, and `ExpiredError`
form a policy sub-hierarchy; `KeyNotFoundError`/`KeyRevokedError`/`KeyRotationError`
a key sub-hierarchy; `DecryptionFailedError`/`SignatureVerificationError` a crypto
sub-hierarchy — mirroring `sdk-python/privyq/exceptions.py`.

## Configuration

`configure(options)` sets a process-wide config; verb functions read it. Options
(and the environment variables that seed the defaults):

| Option | Env var | Default | Purpose |
|--------|---------|---------|---------|
| `gatewayUrl` | `PRIVYQ_GATEWAY_URL` / `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the gateway |
| `apiKey` | `PRIVYQ_API_KEY` | — | Sent as `X-API-Key` |
| `token` | — | — | Sent as `Authorization: Bearer <token>` |
| `defaultAlgorithm` | `PRIVYQ_ALGORITHM` | `kyber_768` | Default KEM for `protect` |
| `defaultSignature` | `PRIVYQ_SIGNATURE` | `dilithium_3` | Default scheme for `seal` |
| `timeoutMs` | `PRIVYQ_TIMEOUT_MS` | `6000` | Per-request timeout |
| `auditEnabled` | `PRIVYQ_AUDIT` | `true` | Advisory audit preference |
| `verifyEvidence` | — | `true` | Advisory chain-verify preference |
| `headers` | — | — | Extra headers on every request |
| `fetch` | — | global `fetch` | Custom fetch (tests, Node < 18) |
| `coreAddress` | — | — | Accepted for blueprint parity; **unused** by the REST transport |

## Types from the contract

The wire types mirror the gateway's OpenAPI (`docs/api/openapi.json`) 1:1 and are
hand-written in [`src/types.ts`](src/types.ts) to keep the package codegen- and
dependency-free. To regenerate a reference from the live spec and reconcile:

```bash
npm run gen:api   # writes src/generated/openapi.d.ts via openapi-typescript
```

## Gateway gaps

The SDK now covers the full blueprint verb vocabulary. The two previously-open
gaps are **closed**:

- **`verify(sealed, { data })`** verifies a `Sealed` signature against the
  original data via `POST /api/v1/verify/seal`. (It still requires `data`; calling
  `verify(sealed)` without it throws a clear error.) Verifying **evidence**
  (`verify(evidence)`) remains fully supported via `POST /api/v1/verify`.
- **`verifyWallet({ scheme?, publicKey, challenge, signature })`** verifies a
  wallet/DID identity proof via `POST /api/v1/identity/wallet` and returns the
  recovered `address` for use as a policy attribute.

One minor difference from the Python SDK remains:

- **`rotateKey` / `revokeKey` options** — the gateway routes take no request body,
  so the Python SDK's `gracePeriod` / `reason` arguments are accepted for
  forward-compatibility but not transmitted.

## Security notes & limitations

- **The client performs no cryptography.** Confidentiality and integrity come
  entirely from the core; a compromised or misconfigured gateway/core is fully
  trusted by the SDK. Run the gateway over TLS in production.
- **API keys are secrets.** Do not embed a privileged `apiKey` in browser code;
  use short-lived per-user bearer tokens minted server-side.
- **`explain()` is local sugar** over `decision.reason`; it never calls the
  network and never leaks anything the decision didn't already carry.
- **Evidence verification** via `verify(evidence)` checks signature + chain
  position as reported by the core; `evidence.verify()` reports chain integrity
  for the returned segment. Neither re-implements the checks client-side.
- **Post-quantum status.** Defaults are Kyber-768 (KEM) and Dilithium-3
  (signatures), selected by the core; see [`docs/v2_blueprint.md` §8](../docs/v2_blueprint.md).

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit (strict)
npm run test        # vitest (fetch is mocked; no gateway needed)
npm run coverage    # vitest run --coverage
npm run build       # tsup → dist/ (ESM + CJS + .d.ts)
```

Tests mock `fetch`, so they run offline and require no gateway. Current coverage
is ~97% of statements (target ≥85%).

## Links

- Full specification: [`docs/v2_blueprint.md` §16](../docs/v2_blueprint.md)
- Architecture: [`docs/SYSTEM_ARCHITECTURE.md`](../docs/SYSTEM_ARCHITECTURE.md)
- REST contract: [`docs/api/openapi.json`](../docs/api/openapi.json)
- Reference SDK: [`sdk-python/`](../sdk-python)
- License: [MIT](LICENSE)
```
