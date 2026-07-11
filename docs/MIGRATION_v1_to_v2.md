# Migrating from PrivyQ v1 to v2

v2 is **additive**: nothing in the v1 public API was renamed or removed, and v1
`ProtectedData` envelopes and evidence entries remain readable. You can adopt v2
verbs incrementally. The v1 thesis line is frozen on the `HOD` branch (tag
`v1.0.0`); v2 development lives on `v2`.

## What's unchanged

- `protect(data, policy)`, `access(protected, identity)`, `verify(evidence)` behave
  as before. Existing code keeps working.
- Defaults: `kyber_768` / `dilithium_3` / AES-256-GCM / SHA-256.
- The gRPC contract only **gained** RPCs; existing ones are untouched.

## What's new (opt-in)

| New | What it gives you |
|-----|-------------------|
| `check(identity, resource)` → `Decision` | The pure authorization decision (no data revealed) — the PDP verb. `Decision` carries `allowed`, `reason`, `matched`, `failed`, `obligations`. |
| `explain(decision)` | The human-readable reason (also `decision.reason`). |
| `seal(data)` / `verify(sealed, data=…)` | Post-quantum signatures over arbitrary data. `verify` now dispatches on evidence vs. seal. |
| `evidence.export(fmt)` | Compliance export as `json` / `csv` / `pdf`. |
| `get_key(id)` / `GET /api/v1/keys/{id}` | Fetch public key info (was unexposed in v1). |
| Gateway `/check`, `/explain`, `/seal`, `/evidence/export`, `/compliance/report` | Policy-Decision-as-a-Service for any microservice. |

## Policy schema

v2 policies add, all optional and backward-compatible:

- **Generic attribute conditions** — condition on *any* attribute, e.g.
  `{"type": "approval_limit", "operator": "gte", "values": ["1000000"]}`.
- **`deny` rules** (`deny_conditions`) — deny overrides allow.
- **Real `custom_logic`** — a sandboxed boolean expression, e.g.
  `role == "manager" and (amount <= approval_limit or emergency)`
  (v1 treated `custom` as `all`; v2 actually evaluates it).
- **`obligations`** — returned on grant (`mask:field`, `log`, `ttl:1h`, …).

## Configuration changes

| Env | Meaning |
|-----|---------|
| `PQC_BACKEND` | `circl` (default, pure-Go) or `liboqs` (needs a `-tags liboqs` build; adds Falcon). |
| `RETENTION_DAYS` | Data retention window (default ~7 years). |
| `ANCHOR_BACKEND` | Opt-in audit-root anchoring: `none` (default) / `file` / chain adapter. |
| `KEY_STORAGE` | `memory` / `local` today; `hsm` / `aws-kms` / `azure-kms` degrade with a clear error until enabled. |
| `PRIVYQ_API_KEYS` / `PRIVYQ_API_KEYS_FILE` | Gateway API keys are now sourced from a store, not hardcoded. |

## Honesty corrections carried into v2

- The default crypto backend is **CIRCL** (standardized ML-KEM/ML-DSA/SLH-DSA),
  not liboqs. liboqs is the opt-in backend and the only way to get Falcon. Docs
  now say so plainly.
- Retention, `audit_events`, and the `users`/`policies`/`resources` tables — marked
  done but unimplemented in v1 — are actually implemented and tested in v2.
