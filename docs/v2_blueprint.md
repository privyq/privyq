# PrivyQ — Complete System Blueprint v2.0

> **Status:** authoritative specification for the **v2** line of PrivyQ, built on the `v2`
> branch. The v1 thesis system is frozen on the `HOD` branch and tagged `v1.0.0`; its spec
> lives in `docs/blueprint.md` (`BP`) and `docs/SYSTEM_ARCHITECTURE.md` (`ARCH`). This
> document supersedes the *positioning and scope* of those, and **reuses their cryptographic,
> policy, audit, and data-structure foundations** except where it explicitly extends or
> corrects them. Where this document and the v1 docs disagree, **this document wins for v2**.
>
> Companion document: `IMPLEMENTATION_PLAN.md` → *Part II — v2* (the task-level tracker). This
> blueprint is the *what and why*; the tracker is the *ordered, checkable how*.

---

# Table of Contents

1. What changed: from thesis to product
2. Vision and positioning
3. The problem PrivyQ v2 solves
4. Capabilities — the trust-infrastructure platform
5. The developer contract — the PrivyQ verb vocabulary
6. Access model — PBAC / ABAC, decisions, and obligations
7. System architecture (v2)
8. Cryptographic foundations (CIRCL default, liboqs optional)
9. Policy Decision Engine (v2)
10. Identity-aware access control
11. Key management (with real HSM / cloud-KMS backends)
12. Tamper-evident audit & evidence (with export and anchoring)
13. Compliance tooling
14. Blockchain integration
15. The Python SDK (v2)
16. The TypeScript / JavaScript SDK (v2)
17. Gateway & Secure APIs (Policy-Decision-as-a-Service)
18. Data model & persistence
19. Deployment, scale & multi-tenancy
20. Security model & threat analysis (v2)
21. Performance & scalability targets
22. Migration from v1 (HOD) to v2
23. Gap closures carried over from v1
24. Testing & quality strategy
25. Limitations & honesty
26. Roadmap
- Appendix A — Data structures
- Appendix B — REST API surface
- Appendix C — Algorithm parameters
- Appendix D — Policy schema (v2)
- Appendix E — Verb reference (quick card)

---

# 1. What changed: from thesis to product

PrivyQ v1 was a **research thesis system**: it proved three contributions end-to-end —
policy-governed post-quantum encryption, cryptographically verifiable privacy evidence, and an
intention-based developer API — and it did so honestly and completely. That work is preserved,
unchanged, on the **`HOD`** branch.

PrivyQ v2 is a **product for the world to use at scale** — from a solo developer securing a
side project to a national parastatal governing access across dozens of services. The research
contributions remain true, but they stop being the *headline* and become *capabilities* inside
a larger, coherent whole. The reframing is deliberate and load-bearing:

| | **v1 (HOD) — thesis** | **v2 — product** |
|---|---|---|
| One-line identity | "Post-quantum cryptography framework" | "The trust-infrastructure SDK for secure applications" |
| Centre of gravity | The cryptography | The **security decision** (who *can* and *should* access) |
| Access model | Policy-governed decryption | Full **PBAC / ABAC** authorization, decryption is one enforcement of it |
| Audience | Researchers, cryptographers, defence committee | Backend, AI-infra, fintech, healthtech, Web3, enterprise, and individuals |
| Crypto backend | CIRCL, *documented as* liboqs (a divergence) | CIRCL default **+ optional liboqs**, documented truthfully |
| Key storage | Local/in-memory; HSM/KMS as interface only | Local **+ real HSM & cloud-KMS backends** |
| Audit | Signed hash chain, listable | Chain **+ export (JSON/CSV/PDF) + opt-in on-chain anchoring** |
| Compliance | Out of scope | **GDPR/HIPAA/SOC2 mapping, retention, reporting** |
| Identity | `identity={...}` dict passed in | **Identity-aware**: providers, attribute resolution, wallet/DID |
| Scale | Single-node demo | **Horizontal scale, HA, multi-tenancy** |

Nothing here relitigates a *locked* v1 cryptographic decision (Kyber-768 / Dilithium-3 /
AES-256-GCM / SHA-256 remain the defaults). It widens the surface around them.

---

# 2. Vision and positioning

> **PrivyQ lets developers describe access policies instead of writing authorization code.
> Protect data once, define your policies, and let PrivyQ enforce them consistently across your
> application.**

The deeper framing that must be carried into every document, README, and marketing surface:

> **Don't let PrivyQ become "the SDK that does cryptography." Let it be "the SDK that
> developers trust to make security decisions correctly."**

That single idea naturally encompasses ABAC, policy enforcement, auditability, compliance,
identity, blockchain integration, and post-quantum security under one trust infrastructure. PQC
is the floor (data is safe even against a future quantum adversary); the **security decision**
is the product.

**Who it serves, at their own scale:**

- **Individual developers** — `pip install privyq`, three verbs, a local core, done. No infra.
- **Startups / SMEs** — one gateway as a Policy-Decision-as-a-Service for all their services.
- **Fintech / healthtech** — purpose-limited, jurisdiction-aware access with provable audit for
  regulators.
- **AI infrastructure** — gate prompts, datasets, models, and APIs by subscription, org, and
  credit policy.
- **Web3 / Web3-adjacent** — wallet-authenticated off-chain access with optional on-chain
  tamper-proofing.
- **Enterprises / parastatals** — consistent authorization across many services, HSM-backed
  keys, multi-tenant isolation, compliance reporting.

---

# 3. The problem PrivyQ v2 solves

Every non-trivial application re-implements authorization, over and over, inline:

```python
if user.role != "admin": raise PermissionDenied()
if document.owner != user.id: raise PermissionDenied()
if document.department != user.department: raise PermissionDenied()
if document.status != "draft": raise PermissionDenied()
if now() > expiry: raise PermissionDenied()
```

Multiply by 50 endpoints × 20 roles × 10 permissions × N microservices and authorization logic
is smeared across the codebase — inconsistent, untested, unauditable, and impossible to reason
about globally. This is the source of a large share of real-world breaches: **not broken
crypto, but broken governance.**

**PrivyQ's answer.** The developer still owns the *business* policy — they say what should be
true. They stop owning the *enforcement engine*. They write the policy once:

```json
{
  "resource": "financial_report",
  "allow": { "role": ["finance_manager"], "department": "finance",
             "purpose": "monthly_reporting", "expires": "2027-01-01" }
}
```

…and the endpoint collapses to intent:

```python
report = privyq.access(ciphertext, context)   # authorized + revealed, or denied with a reason
generate_monthly_report(report)
```

Crucially this is **not "no more roles."** Developers still define roles and business rules.
They no longer *implement and maintain the authorization engine* that enforces them. And because
PrivyQ evaluates **attributes**, not just roles, it is strictly more expressive than RBAC:

```json
{ "role": "doctor", "hospital": "LUTH", "purpose": "treatment",
  "shift": "active", "expires": "24h", "location": "NG" }
```

That is **Policy-Based / Attribute-Based Access Control (PBAC/ABAC)** — it answers not only *who
can* access a record but *who should*, given the full context, without the repeated `if`
ladder.

---

# 4. Capabilities — the trust-infrastructure platform

PrivyQ v2 is one product with nine capabilities. Each is a lens on the same core (the Go
decision engine); none is a separate system.

1. **Policy / attribute-based access control (PBAC/ABAC)** — the flagship. Describe, don't code.
2. **Policy-bound post-quantum encryption** — protect data with an embedded policy; access is a
   policy decision, not just a key operation.
3. **Key management** — lifecycle, hierarchy, rotation/revocation, with real HSM & cloud-KMS.
4. **Secure APIs** — the gateway is a hardened REST surface *and* a Policy-Decision-as-a-Service
   any service can call.
5. **Digital signatures** — post-quantum `seal()` / `verify()` over documents and messages.
6. **Tamper-evident audit logs** — signed, hash-chained evidence for every decision, exportable
   for compliance, optionally anchored on-chain.
7. **Compliance tooling** — GDPR/HIPAA/SOC2 control mapping, retention/archival, reporting.
8. **Identity-aware access control** — pluggable identity providers and attribute sources,
   including wallet/DID.
9. **Quantum-safe cryptography** — ML-KEM / ML-DSA / SLH-DSA today; liboqs breadth optional.

---

# 5. The developer contract — the PrivyQ verb vocabulary

The v1 promise — *three verbs hid all my cryptography* — becomes a slightly larger, still
intention-based vocabulary. We never expose `encrypt` / `decrypt` / `sign`; we expose what the
developer *means*. This vocabulary is **locked** for v2 (chosen 2026-07-11):

| Verb | Signature | Means | Replaces |
|------|-----------|-------|----------|
| `protect` | `protect(data, policy, **opts) -> ProtectedData` | Encrypt data and embed its policy | `encrypt` |
| `access` | `access(protected, identity, *, purpose=None) -> Data` | Authorize against the embedded policy, then reveal — or deny with a reason | `decrypt` |
| `check` | `check(identity, resource, *, purpose=None) -> Decision` | The pure authorization decision — **no data revealed** | `authorize`, `evaluate_policy` |
| `explain` | `explain(decision) -> str` | Human-readable why (also `decision.reason`) | `explain_denial` |
| `seal` | `seal(data, key=None) -> Sealed` | Post-quantum digital signature over arbitrary data | `sign` |
| `verify` | `verify(x) -> VerificationResult` | Verify audit evidence **or** a `Sealed` signature (dispatched by type) | `verify` |
| `evidence.of` | `evidence.of(resource_id) -> list[Evidence]` | The audit trail for a resource | `audit()`, `evidence_log` |
| `evidence.verify` | `evidence.verify(chain=None) -> VerificationResult` | Verify the whole chain | — |
| `evidence.export` | `evidence.export(format, **filters) -> bytes` | Compliance export (JSON/CSV/PDF) | — |

Key relationships:

- **`access` = `check` + reveal.** `access` internally makes the same decision `check` returns,
  then decrypts iff `allowed`. Both emit evidence (granted *and* denied).
- **`check` never touches plaintext.** It is the verb services call in a request path to gate an
  action that isn't itself an encrypted blob (a transfer, an API call, a model invocation).
- **Every `Decision` explains itself.** `decision.reason` is always populated; `explain()` is
  sugar for reporting/UX. A denied `access` raises `AccessDenied` carrying the same reason.

Worked example — the value proposition in five lines:

```python
decision = privyq.check(user, invoice)          # no data revealed, just the decision
# Decision(allowed=False,
#          reason="Role 'Reviewer' cannot approve invoices above ₦5,000,000.",
#          failed=["approval_limit"], matched=["role","department"])
if not decision.allowed:
    return http_403(privyq.explain(decision))
data = privyq.access(invoice, user, purpose="approval")   # authorized + revealed
```

---

# 6. Access model — PBAC / ABAC, decisions, and obligations

## 6.1 Attributes, not just roles

A policy is evaluated against four attribute categories (the ABAC quadrant):

- **Subject** — the identity: `role`, `department`, `organization`, `clearance`, wallet address,
  arbitrary custom claims.
- **Resource** — attributes embedded at `protect` time or attached to a resource record:
  `classification`, `owner`, `status`, `hospital`, `approval_limit`.
- **Action / purpose** — *why* access is requested: `purpose="treatment"`, `action="approve"`.
  Purpose limitation is a first-class citizen (GDPR Art. 5(1)(b)).
- **Environment** — `time_of_day`, `shift`, `location`/`jurisdiction`, `device_type`,
  `emergency` (break-glass), request IP, current time.

Any attribute the developer supplies can be conditioned on; PrivyQ does not hard-code a closed
list. The v1 condition registry (role, department, purpose, classification, expiry, valid_from,
valid_until, jurisdiction, organization, location, time_of_day, device_type, delegation) is the
built-in starting set; v2 adds a **generic attribute condition** so `approval_limit`,
`subscription`, `credits`, `shift`, `hospital`, etc. work without new code.

## 6.2 The Decision

`check` (and internally `access`) returns a `Decision`:

```jsonc
{
  "allowed": false,
  "reason": "Role 'Reviewer' cannot approve invoices above ₦5,000,000.",
  "matched":   ["role", "department"],      // conditions that passed
  "failed":    ["approval_limit"],          // conditions that failed
  "obligations": ["mask:account_no", "log"],// side-effects enforcement must honour
  "policy_id": "invoice-approval-v3",
  "evaluated_at": "2026-07-11T14:22:03Z"
}
```

Every decision is **explainable, deterministic, and logged**. This is the single most valuable
property for debugging, compliance, and UX — a denial is never a silent 403.

## 6.3 Allow / deny and combination logic

- Policies carry `allow` rules and optional `deny` rules. **Deny overrides allow.**
- Combination within a rule: `all` (default), `any`, or `custom`. **v2 ships a real expression
  engine for `custom`** — a safe, sandboxed boolean expression over attributes (e.g.
  `role == "manager" and (amount <= approval_limit or emergency)`), closing the v1 gap where
  `custom` silently fell back to `all`.
- Per-condition `negate` is retained from v1.

## 6.4 Obligations

Beyond allow/deny, a policy may attach **obligations** the enforcement point must honour when
granting: `mask:<field>`, `redact:<field>`, `watermark`, `require_mfa`, `notify:<channel>`,
`ttl:<duration>`. Obligations turn "yes/no" into "yes, but…", which real systems need
(e.g. a researcher may read a record with PII fields masked).

---

# 7. System architecture (v2)

The strict layering of v1 is kept — each layer talks only to its neighbours, and **only the Go
core performs cryptography or evaluates policy** — but the core is repositioned as a
**Trust Decision Service**, and a new integration shape (services calling the gateway as a PDP)
is made first-class.

```
                         ┌─────────────────────────────────────────────┐
                         │  Applications & services (any language)     │
                         │  frontend · orders · payments · AI · docs…  │
                         └───────────────┬─────────────────────────────┘
             SDK (in-proc)               │  REST / gRPC  (Policy-Decision-as-a-Service)
        ┌────────────────────┐           ▼
        │  PrivyQ SDK        │   ┌──────────────────┐
        │  (Python + JS/TS)  │   │  FastAPI Gateway │  auth (API-key/JWT/OAuth2/mTLS),
        │  protect/access/   │   │  + PDP endpoint  │  rate limit, tenancy, OpenAPI
        │  check/explain/…   │   └────────┬─────────┘
        └─────────┬──────────┘            │ gRPC (TLS/mTLS)
                  └───────────────┬───────┘
                                  ▼
                   ┌─────────────────────────────────┐
                   │   Go Trust Decision Core        │   the ONLY place crypto + policy live
                   │  ┌───────────┬───────────────┐  │
                   │  │ PQC engine│ Policy Decision│  │   KEM · signatures · hybrid enc
                   │  │ (CIRCL /  │  Engine (ABAC) │  │   ABAC + expression engine + obligations
                   │  │  liboqs)  ├───────────────┤  │
                   │  │           │ Audit / Evidence│  │   sign · hash-chain · export · anchor
                   │  ├───────────┼───────────────┤  │
                   │  │ Key mgr   │ Identity /     │  │   local · HSM · AWS/Azure KMS
                   │  │ + backends│ attribute res. │  │   providers, wallet/DID verify
                   │  └───────────┴───────────────┘  │
                   └───────────────┬─────────────────┘
                                   ▼
          PostgreSQL (keys, policies, resources, users, evidence, audit_events, tenants)
                                   │
                        (opt-in)   ▼
                     Blockchain anchor (audit-root notarisation) · wallet identity verify
```

Contracts unchanged in kind, extended in content: the **gRPC `.proto`** is the SDK↔core
contract; the **OpenAPI** spec is the client↔gateway contract; both gain the new verbs
(`Check`, `Explain`, `Seal`, evidence export) and the PDP endpoint.

---

# 8. Cryptographic foundations (CIRCL default, liboqs optional)

**Decision (locked 2026-07-11): CIRCL is the default backend; liboqs is an optional, pluggable
backend. All documentation states this truthfully.** This corrects the single largest honesty
gap in v1, where the code used pure-Go Cloudflare CIRCL while the docs claimed liboqs/CGO
throughout.

- **Default — CIRCL (pure Go, no CGO):** ML-KEM (Kyber) 512/768/1024, ML-DSA (Dilithium)
  2/3/5, SLH-DSA (SPHINCS+) 128s/192s/256s. Zero system dependencies — trivial to build,
  containerise, and scale. This is what `pip install privyq` + a stock core image gives you.
- **Optional — liboqs (CGO):** selected via `PQC_BACKEND=liboqs`, adds algorithm breadth,
  notably **Falcon (FN-DSA) 512/1024**, and reference-library parity for organisations that
  require it. Guarded behind a build tag so the default build has no C dependency.
- **Backend interface:** `kem.Scheme` and `signatures.Scheme` abstract the provider; callers
  never know which backend answered. Adding liboqs touches no caller (honours ARCH §25.2).
- **Symmetric & hybrid:** unchanged — AES-256-GCM, hybrid KEM-encapsulate-then-AEAD
  (`ProtectedData` structure, BP App A.1).
- **Hashing:** SHA-256 for resource/policy/chain hashing (BP App C.4).

Defaults remain `kyber_768` (NIST L3) and `dilithium_3`. `NTRU` remains an optional/alternative
KEM (low priority). Falcon becomes *real* only under the liboqs backend; the CIRCL default
documents Falcon as "available with `PQC_BACKEND=liboqs`," never as silently present.

---

# 9. Policy Decision Engine (v2)

The heart of the product. Extends the v1 engine (`internal/policies/`) which already implements
every App D condition type and operator.

- **Generic attribute conditions** — condition on any subject/resource/environment attribute,
  not only the built-in registry, using the full operator set (`equals`, `in`, `contains`,
  `before/after/between`, `gt/gte/lt/lte`, `starts_with/ends_with`, `negate`).
- **Real `custom` combination** — a sandboxed boolean-expression evaluator (no arbitrary code
  execution; a small, audited grammar over attributes + literals + `and/or/not` + comparisons).
  Closes v1 gap B7.
- **Deny rules** — `deny` overrides `allow`; supports explicit revocation-style rules.
- **Obligations** — evaluated and returned on every allow decision (§6.4).
- **Explanations** — every decision returns `matched`, `failed`, and a rendered `reason`
  string; templates make reasons human ("Role 'Reviewer' cannot approve invoices above ₦5m")
  rather than raw ("approval_limit: gt failed").
- **Purpose limitation** — `purpose` is a required, first-class dimension of every decision.
- **Determinism & performance** — sub-millisecond evaluation; pure function of (policy,
  attributes, clock). Target ≥95% test coverage (BP §23.2), including every App D.4 example plus
  the new v2 scenarios (banking approval-limit, AI subscription/credits, break-glass).
- **Extensibility hooks** — the engine keeps an interface seam for external policy backends
  (OPA/Rego, XACML) as documented future work; v2 does not ship them but must not preclude them.

---

# 10. Identity-aware access control

v1 accepted `identity={...}` as a caller-supplied dict. v2 makes identity a **resolved,
pluggable** concept while keeping the simple path intact.

- **Identity providers (pluggable):** a caller may pass a raw attribute dict (simple path,
  unchanged), *or* PrivyQ can resolve attributes from a configured provider (JWT/OIDC claims,
  API-key → principal mapping, a directory, or a custom resolver).
- **Attribute resolution:** providers contribute subject attributes that feed the decision;
  precedence and conflict rules are explicit and logged in evidence.
- **Wallet / DID identity:** a signed wallet challenge (e.g. an Ethereum/EVM `personal_sign`
  or a DID auth proof) is verified by the core and yields a verified `wallet`/`did` subject
  attribute usable in any policy (`"wallet": "0xabc…"`). This is the identity half of the
  blockchain capability (§14).
- **Break-glass:** an `emergency` environment attribute can satisfy otherwise-failing policies
  when a policy explicitly allows it — always producing a distinctly-flagged evidence entry.

---

# 11. Key management (with real HSM / cloud-KMS backends)

Extends v1's key lifecycle (Created→Active→Rotated→Revoked/Expired/Archived) and org→dept→user
hierarchy, which are already built.

- **Storage backends (real, not stubs):** `KEY_STORAGE ∈ {memory, local, hsm, aws-kms,
  azure-kms}`. v1 crashed on the last three (gap B3); v2 ships working PKCS#11 (HSM), AWS KMS,
  and Azure Key Vault backends behind the existing `KeyStorage` interface, with `local`
  (encrypted-at-rest) and `memory` retained for dev. Unknown values degrade with a clear error,
  never a `log.Fatal`.
- **Key types:** primary, signature, rotation, delegation, emergency (BP §16.1).
- **Rotation & revocation:** rotate without re-encrypting data (envelope/rewrap); revocation
  updates policy enforcement immediately.
- **`get_key(id)`** is exposed through the SDK and gateway (`GET /api/v1/keys/{id}`), closing
  v1 gap B6 (the core RPC already existed, unexposed).

---

# 12. Tamper-evident audit & evidence (with export and anchoring)

The v1 audit engine (Dilithium-signed, SHA-256 hash-chained evidence with tamper/deletion/
forgery detection) is the foundation and is kept intact. v2 completes it:

- **Every decision produces evidence** — `access` (granted/denied), `check`, `seal`/`verify`,
  and key-lifecycle events. Entry structure per BP App A.2 plus the `Decision` (`matched`,
  `failed`, `reason`, `obligations`).
- **`audit_events` table** is created and written (closes v1 gap B4), distinct from the raw
  `evidence_log` chain.
- **Export (`evidence.export`)** in **JSON / CSV / PDF** for compliance reporting (closes gap
  B9; BP §15.5, ARCH §15.4). PDF export renders a signed, verifiable report.
- **Retention & archival** — configurable retention (default 7 years) with automated archival/
  deletion jobs (closes gap B8; ARCH §12.3).
- **On-chain anchoring (opt-in)** — periodically publish the current chain root (a hash) to a
  configured blockchain so third parties can prove the log existed and is unaltered without
  trusting PrivyQ's operator. Off by default; adds no latency to the request path.

---

# 13. Compliance tooling

New in v2. Compliance is where "provable governance" pays off commercially.

- **Control mapping:** map policies and evidence to GDPR (purpose limitation, data-subject
  access, erasure records), HIPAA (minimum-necessary, audit controls), and SOC 2 (access
  control, monitoring) controls.
- **Reports:** generate per-resource, per-subject, and per-period compliance reports from the
  evidence chain (built on `evidence.export`).
- **Data-subject requests:** given a subject, produce every access to their data and every
  policy that governed it — a signed, verifiable answer to "prove it."
- **Retention policy:** the retention/archival engine (§12) is the enforcement arm; compliance
  tooling is the reporting arm.

Multi-tenancy-wide compliance dashboards are a gateway/frontend concern (§17, §19).

---

# 14. Blockchain integration

**Decision (locked 2026-07-11): wallet/DID identity + opt-in audit anchoring. No mandatory
smart-contract dependency.**

- **Wallet identity (identity side, §10):** verify a signed wallet/DID challenge → a trusted
  `wallet`/`did` subject attribute usable in any policy. Enables the canonical Web3 flow:
  *wallet authenticated → user requests protected invoice → backend `check`s the policy →
  allowed → `access` reveals it.* No smart-contract changes, no duplicated backend logic.
- **Audit anchoring (evidence side, §12):** opt-in notarisation of the evidence chain root
  on-chain for public, operator-independent tamper-proofing.
- **Explicitly out of v2 scope:** on-chain policy execution / smart-contract PDPs, on-chain key
  distribution, token-gating primitives. The seams remain so they can be added later.

Chain, RPC endpoint, and anchoring cadence are configuration; the default build works with no
blockchain at all.

---

# 15. The Python SDK (v2)

The reference SDK. Thin, fully typed, friendly errors — extends the v1 package.

```python
from privyq import (
    configure,
    protect, access, check, explain,     # decisions
    seal, verify,                        # signatures + verification
    evidence,                            # evidence.of / .verify / .export / .log
    generate_key, rotate_key, revoke_key, get_key,
)

configure(core_address="localhost:50051", default_algorithm="kyber_768",
          default_signature="dilithium_3", audit_enabled=True)

protected = protect(patient_record, policy={
    "allow": {"role": "doctor", "hospital": "LUTH", "purpose": "treatment",
              "shift": "active", "expires": "24h"}})

decision = check({"role": "nurse", "hospital": "LUTH"}, protected)   # -> Decision(allowed=False, reason=…)
record   = access(protected, {"role": "doctor", "hospital": "LUTH"}, purpose="treatment")

sealed   = seal(discharge_summary)          # post-quantum signature
ok       = verify(sealed)                   # or verify(evidence_entry)

trail    = evidence.of(protected.resource_id)
report   = evidence.export("pdf", resource_id=protected.resource_id)
```

- **Exceptions** extend the v1 hierarchy: `AccessDenied` (carries `decision.reason`),
  `PolicyViolationError`, `KeyNotFoundError`, `AuditVerificationError`, `CoreUnavailableError`.
  gRPC status → exception mapping preserved (ARCH §21.3).
- **Typing:** full type hints; `Decision`, `ProtectedData`, `Sealed`, `Evidence`,
  `VerificationResult` are typed dataclasses.
- **Coverage target:** ≥85% (BP §23.2), with a runnable quickstart and notebook.

---

# 16. The TypeScript / JavaScript SDK (v2)

**A first-class, full SDK — a peer of the Python SDK, not a stub or roadmap item.** It lives at
`sdk-js/`, is authored in TypeScript, and ships compiled JavaScript + type declarations for both
**Node and the browser**. It is the highest-leverage second SDK: it serves the frontend, the
Web3 audience, and the enormous JS/TS backend ecosystem. It carries **the same Decision-verb
vocabulary and feature set as Python** — no capability is Python-only.

```ts
import {
  configure,
  protect, access, check, explain,     // decisions
  seal, verify,                        // signatures + verification
  evidence,                            // evidence.of / .verify / .export / .log
  generateKey, rotateKey, revokeKey, getKey,
} from "@privyq/sdk";

configure({ coreAddress: "localhost:50051", defaultAlgorithm: "kyber_768" });

const protectedData = await protect(patientRecord, {
  allow: { role: "doctor", hospital: "LUTH", purpose: "treatment",
           shift: "active", expires: "24h" },
});

const decision = await check({ role: "nurse", hospital: "LUTH" }, protectedData);
// Decision { allowed: false, reason: "…", failed: ["shift"], matched: ["role","hospital"] }

const record  = await access(protectedData, { role: "doctor", hospital: "LUTH" },
                             { purpose: "treatment" });
const sealed  = await seal(dischargeSummary);
const ok      = await verify(sealed);              // or verify(evidenceEntry)
const report  = await evidence.export("pdf", { resourceId: protectedData.resourceId });
```

- **Transport:** talks to the gateway over REST by default (browser-safe), and to the core over
  gRPC/gRPC-web where available (Node). Types are generated from the same OpenAPI/`.proto` — no
  hand-written DTOs (mirrors the frontend's `openapi-typescript` rule in `CLAUDE.md`).
- **Feature parity:** every verb, `Decision`/`Sealed`/`Evidence`/`VerificationResult` types,
  obligations, wallet/DID identity helpers, and the exception hierarchy (`AccessDenied` carrying
  `decision.reason`, etc.) match Python.
- **Ergonomics:** idiomatic camelCase, Promises/async, tree-shakeable ESM + CJS builds,
  `strict` TypeScript, zero crypto in the client (it calls the core — the honesty invariant).
- **Packaging:** published to npm as `@privyq/sdk`; `sdk-js/README.md` to the `CLAUDE.md`
  standard; ≥85% test coverage (Vitest), with runnable Node and browser quickstarts.
- **Frontend:** the Next.js app consumes `@privyq/sdk` (or its generated client) rather than
  hand-rolling fetch calls — the SDK is dogfooded by our own demo.

## 16.1 Further language SDKs (roadmap, post-2.0)

Go client, Java, Rust, C#/.NET (BP §20.5), ordered by demand. **No SDK re-implements crypto or
policy — they all call the core.** This keeps every language honest and consistent (the
multi-service consistency argument, applied across languages).

---

# 17. Gateway & Secure APIs (Policy-Decision-as-a-Service)

The FastAPI gateway is both a REST surface and a **PDP any service can call** — the mechanism
that delivers "every service follows the same rules."

- **Endpoints:** the full v1 REST surface (protect, access, verify, evidence/log, keys
  generate/rotate/revoke, health) **plus** `GET /keys/{id}` (gap B6), `POST /check`,
  `POST /explain`, `POST /seal`, `GET|POST /evidence/export`, and `GET /compliance/report`.
  Full table in Appendix B.
- **Policy-Decision-as-a-Service:** `POST /check` lets any microservice (orders, payments, AI,
  docs) ask "can this identity do this?" and get a `Decision` — one authorization brain for the
  whole architecture. This is the multi-service consistency story made concrete.
- **Auth (production-grade, closing v1 gap C4):** API keys sourced from a store (not a hardcoded
  dict), JWT, **OAuth2**, and per-request **mTLS** for internal service-to-service calls.
- **Rate limiting, structured errors, structured JSON logging** — retained and hardened.
- **Multi-tenancy** — tenant scoping on every request (§19).

---

# 18. Data model & persistence

Completes the v1 schema, which created but never used several tables.

- **Live tables:** `users`, `keys`, `policies`, `resources`, `evidence_log`, **`audit_events`
  (new — gap B4)**, and **`tenants`** (new). The gateway/core now actually read and write
  `users`, `policies`, and `resources` (closes gap B5), not just `keys`/`evidence_log`.
- **Indexes & retention:** per ARCH §12.2–12.3, with the retention/archival jobs of §12.
- **Migrations:** extend the existing `golang-migrate` set; every table has a migration and is
  exercised by tests.
- **Persistence guarantee (retained from v1 D3):** evidence written during an access survives a
  restart and still verifies — now also true for policies, resources, and users.

---

# 19. Deployment, scale & multi-tenancy

- **Local / individual:** `pip install privyq` + a single core binary or one `docker run`. No
  Postgres required for the in-memory/local path.
- **Team / production:** `docker compose up` brings up core + gateway + frontend + Postgres
  (retained from v1 X1); Kubernetes manifests for HA (multiple stateless core + gateway
  replicas behind Postgres).
- **Horizontal scale:** core and gateway are stateless; scale by replica count. Postgres and the
  KMS/HSM are the stateful edges. Targets and bottlenecks per BP §19.2.
- **Multi-tenancy:** tenant isolation at the data layer (tenant-scoped rows + row-level checks)
  and the auth layer (tenant-bound credentials). A single deployment can serve many
  organisations without cross-tenant leakage.

---

# 20. Security model & threat analysis (v2)

Inherits v1's model (BP §18) and updates it for the honest backend and new surface:

- **Quantum threats** — mitigated by ML-KEM/ML-DSA (CIRCL) or liboqs; harvest-now-decrypt-later
  is addressed at rest and in the hybrid scheme.
- **Access-control threats** — the whole point: centralised, tested, explainable decisions with
  deny-override and obligations reduce the misconfiguration surface that inline `if` ladders
  create.
- **Audit threats** — signed hash chain + optional on-chain anchoring; tamper/deletion/forgery
  detectable, now also by third parties.
- **Supply-chain threats** — **corrected**: v1's "compromised liboqs" mitigation was moot
  because liboqs wasn't used. v2 states the real dependency (CIRCL by default) and applies
  verified builds / dependency scanning to whichever backend is compiled in.
- **Infrastructure threats** — mTLS internally, secrets via env/KMS, HSM-backed keys for the
  highest tier.
- **Insider threats** — purpose limitation, obligations (masking), and immutable evidence.

Honesty rule (a core project principle): **never describe an unbuilt feature as if it works.** The v1 tracker's incorrect `[x]` marks (liboqs, retention, testcontainers) are
corrected as part of v2, not inherited.

---

# 21. Performance & scalability targets

Retain the v1 targets (ARCH §24.3, BP §19.1) — met with large margins in v1 benchmarks — and
add decision-path targets:

- **`check` (no decryption):** sub-millisecond policy evaluation; p99 well under the crypto path.
- **`access`:** dominated by KEM+AEAD; unchanged from v1 (20–60× under target in benchmarks).
- **PDP throughput:** the gateway `POST /check` must sustain high RPS (it is on the hot path of
  every gated request in a multi-service deployment); load-tested with k6.
- **Coverage:** core ≥90% overall, policy engine ≥95% (BP §23.2) — v2 must actually reach this
  (v1 stalled at ~82%, gap C3).

---

# 22. Migration from v1 (HOD) to v2

- **Branches:** `HOD` = frozen v1 (`v1.0.0`). `v2` = active development. `main` untouched until
  v2 is ready to become the mainline.
- **Compatibility:** the v1 verbs (`protect`, `access`, `verify`) are unchanged. New verbs
  (`check`, `explain`, `seal`, `evidence.*`) are additive. Existing v1 `ProtectedData` and
  evidence entries remain readable.
- **Naming:** no v1 public verb is renamed or removed; v2 only *adds*. Internal `authorize`/
  `evaluate_policy`/`explain_denial`/`audit` naming (never public) resolves to the locked
  vocabulary of §5.
- **Docs:** v1 docs stay as the thesis record; this document governs v2.

---

# 23. Gap closures carried over from v1

v2 explicitly closes the real gaps found in the v1 audit (see `IMPLEMENTATION_PLAN.md` log,
2026-07-11). Summary:

| v1 gap | Closure in v2 | Section |
|--------|---------------|---------|
| B1 Falcon not implemented | Falcon via optional liboqs backend | §8 |
| B3 `KEY_STORAGE=hsm/aws-kms/azure-kms` crashes | Real HSM/AWS/Azure backends; graceful errors | §11 |
| B4 `audit_events` table absent | Created and written | §12, §18 |
| B5 `users`/`policies`/`resources` tables dead | Read & written by core/gateway | §18 |
| B6 `GET /keys/{id}` missing | Exposed in SDK + gateway | §11, §17 |
| B7 `custom` combination silently == `all` | Real sandboxed expression engine | §6.3, §9 |
| B8 retention/archival not implemented | Configurable 7y retention + archival jobs | §12 |
| B9 evidence export missing | `evidence.export` JSON/CSV/PDF | §12, §15 |
| B10 SDK missing `check`/`explain`/export helpers | New verb vocabulary | §5, §15 |
| C1 CIRCL-not-liboqs, docs wrong | CIRCL default + optional liboqs, docs corrected | §8, §20 |
| C3 coverage ~82% vs 90/95% | Coverage brought to target | §21, §24 |
| C4 demo-grade gateway auth | API-key store, OAuth2, mTLS | §17 |
| Doc-accuracy `[x]` lies (retention/testcontainers) | Tracker corrected, real tests added | §24 |

---

# 23a. Examples & developer demonstrations

Adoption lives or dies on examples. v2 ships a **broad, runnable example suite in both SDKs**
that demonstrates **every verb** and each headline scenario, so a developer can copy-paste their
way to working code.

- **Location & parity:** `examples/python/` and `examples/js/` (extending today's four Python
  examples). Every scenario exists in **both** languages so neither SDK looks second-class.
- **Verb coverage:** at least one example each for `protect`, `access`, `check` (the
  PDP/no-reveal path), `explain`, `seal`/`verify`, `evidence.of/verify/export`, obligations
  (masking), wallet/DID identity, and multi-service `check` (one policy brain across services).
- **Scenario coverage:** the canonical domains — **healthcare** (treatment vs. research with
  masking), **banking** (approval-limit + break-glass), **AI infrastructure** (subscription/
  credits gating), **legal** (delegation), **Web3** (wallet-authenticated access) — plus a
  **compliance-report** walkthrough.
- **Runnable & verified:** each example runs against a local core/gateway and is **exercised in
  CI** (they are smoke tests, so a broken example fails the build — no rotted samples).
- **Mirrored in the frontend:** the Next.js playground surfaces the same scenarios interactively,
  showing `Decision` reasons, obligations, and the audit trail (see §9 / Part II V9).

---

# 24. Testing & quality strategy

- **Unit** — table-driven Go tests; every new condition, the expression engine, obligations,
  each KMS backend (mocked + one real integration path).
- **Integration** — real `tests/integration/` with **testcontainers Postgres** (closes the v1
  overstatement where this was claimed but absent); SDK↔core and gateway↔SDK.
- **E2E** — Playwright drives the full scenario set: protect → authorized access → denied
  attempt (with reason) → `check` in a service path → audit verify → **tamper detection** →
  evidence export.
- **Performance** — k6 for the gateway and the PDP `POST /check` path.
- **Coverage goals** — core ≥90% / policy ≥95% (actually met), SDK ≥85%, gateway ≥80%.
- **Security scanning** — govulncheck / pip-audit / npm audit in CI, plus SAST (retained from
  v1 X5), now scanning the truthful dependency set.

---

# 25. Limitations & honesty

Written for skeptical expert reviewers:

- **Default crypto is CIRCL, pure Go.** Cryptographically it is the NIST-standardised
  ML-KEM/ML-DSA/SLH-DSA, but it is *not* liboqs. liboqs (and Falcon) require the optional CGO
  backend. We say so plainly everywhere.
- **PrivyQ decides; it does not authenticate for you.** Identity providers resolve attributes,
  but the trust in those attributes is only as good as the provider (a JWT is trusted iff its
  signer is trusted). Wallet/DID proofs are verified cryptographically; other claims are as
  strong as their source.
- **On-chain anchoring proves existence/integrity, not correctness of a decision.** It notarises
  the log; it does not re-run policy.
- **Obligations are advisory to the enforcement point.** PrivyQ returns them; the calling code
  (or the gateway) must honour `mask`/`redact`/etc. The SDK provides helpers, but a caller that
  ignores an obligation defeats it.
- **Not a replacement for TLS, an IdP, or a WAF.** It is the authorization-and-evidence layer.

---

# 26. Roadmap

- **v2.0 (this line):** the trust-infrastructure repositioning; ABAC/PBAC decision engine with
  explanations and obligations; the locked verb vocabulary; real HSM/KMS; export + retention +
  compliance reporting; wallet identity + opt-in anchoring; production gateway auth + PDP;
  TypeScript SDK; multi-tenancy; all v1 gap closures; coverage and doc-accuracy fixed.
- **Post-2.0:** external policy backends (OPA/Rego, XACML); more language SDKs; WASM browser
  core; deeper on-chain (smart-contract PDPs); ZK/ABAC advanced features; hosted "PrivyQ Cloud."

---

# Appendix A — Data structures

Extends BP App A. Unchanged: `ProtectedData` (A.1), `Evidence` entry (A.2), `Key` (A.3). Added:

- **`Decision`** — `{allowed, reason, matched[], failed[], obligations[], policy_id, evaluated_at}`.
- **`Sealed`** — `{data_hash, signature, algorithm, key_id, sealed_at}` (post-quantum signature).
- **`Tenant`** — `{tenant_id, name, created_at, settings}`.
- **`AuditEvent`** — `{id, resource_id, actor_id, action, status, evidence_id, timestamp}`
  (the previously-missing table, BP/ARCH §12.1).

# Appendix B — REST API surface

v1 endpoints (BP App B) plus v2 additions. Prefix `/api/v1/`.

| Method | Path | Purpose | Status |
|--------|------|---------|--------|
| POST | `/protect` | Protect data with policy | v1 |
| POST | `/access` | Authorize + reveal | v1 |
| POST | `/check` | Decision only, no reveal (PDP) | **v2** |
| POST | `/explain` | Human-readable reason for a decision | **v2** |
| POST | `/verify` | Verify evidence or a seal | v1 (extended) |
| POST | `/seal` | Post-quantum signature | **v2** |
| GET | `/evidence/log` | Query evidence trail | v1 |
| GET | `/evidence/export` | Export evidence (json/csv/pdf) | **v2** |
| GET | `/compliance/report` | Compliance report | **v2** |
| GET | `/keys` | List keys | v1 |
| GET | `/keys/{id}` | Get public key info | **v2** (gap B6) |
| POST | `/keys/generate` · `/keys/rotate/{id}` · `/keys/revoke/{id}` | Key lifecycle | v1 |
| GET | `/health` | Health | v1 |

# Appendix C — Algorithm parameters

Unchanged from BP App C for the CIRCL default (Kyber 512/768/1024, Dilithium 2/3/5, SPHINCS+/
SLH-DSA 128s/192s/256s, AES-256-GCM, SHA-256). **Falcon 512/1024** parameters (BP App C.2) apply
only under `PQC_BACKEND=liboqs`. NTRU (App C.1) remains optional/unbuilt.

# Appendix D — Policy schema (v2)

Extends BP App D. A policy document:

```jsonc
{
  "resource": "financial_report",          // resource type / id
  "policy_id": "invoice-approval-v3",
  "allow": {                                // subject/resource/env attribute conditions
    "role": ["finance_manager"],
    "department": "finance",
    "purpose": "monthly_reporting",         // purpose limitation (first-class)
    "approval_limit": { "op": "gte", "value": 1000000 },   // generic attribute condition
    "expires": "2027-01-01",
    "combination": "all"                    // all | any | custom
  },
  "deny": { "location": { "op": "not_in", "value": ["NG","GH"] } },  // deny overrides allow
  "custom_logic": "role == 'manager' and (amount <= approval_limit or emergency)", // when combination=custom
  "obligations": ["mask:account_no", "log", "ttl:1h"]
}
```

- All v1 condition types and operators are retained (BP App D.2–D.3), plus **generic attribute
  conditions**, **`deny`**, real **`custom_logic`**, and **`obligations`**.
- `expires` accepts an absolute date or a relative duration (`"24h"`, `"12h"`).

# Appendix E — Verb reference (quick card)

```
protect(data, policy, **opts)         -> ProtectedData      # was encrypt
access(protected, identity, purpose=) -> Data               # was decrypt (authorize + reveal)
check(identity, resource, purpose=)   -> Decision           # was authorize / evaluate_policy
explain(decision)                     -> str                # was explain_denial
seal(data, key=None)                  -> Sealed             # was sign
verify(evidence | sealed)             -> VerificationResult # verify audit OR signature
evidence.of(resource_id)              -> list[Evidence]     # was audit()
evidence.verify(chain=None)           -> VerificationResult
evidence.export(format, **filters)    -> bytes              # json | csv | pdf
generate_key / rotate_key / revoke_key / get_key
configure(...)
```
