# PrivyQ Python SDK (`privyq`)

The developer-facing interface to PrivyQ. It hides all cryptographic and gRPC
detail behind intention-based verbs, so you think in terms of *business intent*,
not primitives — you **describe policies** and let PrivyQ make the decisions.

## The verbs (v2)

| Verb | Does |
|------|------|
| `protect(data, policy)` | Encrypt + embed the policy in the ciphertext |
| `access(protected, identity)` | Authorize against the policy, then reveal — or deny with a reason |
| `check(identity, resource)` → `Decision` | The pure decision (no data revealed) — the PDP verb |
| `explain(decision)` | Human-readable reason (also `decision.reason`) |
| `seal(data)` → `Sealed` · `verify(sealed, data=…)` | Post-quantum signatures |
| `verify(receipt)` | Verify audit evidence |
| `evidence.log/of/export(fmt)` | Query + export (json/csv/pdf) the audit trail |
| `generate_key/get_key/rotate_key/revoke_key` | Key lifecycle |

```python
# Decide without revealing anything (great for gating any action):
decision = privyq.check({"role": "nurse"}, protected)
if not decision.allowed:
    return http_403(privyq.explain(decision))   # "role condition not met (needed doctor)"
```

```python
import privyq

privyq.configure(core_address="localhost:50051")

# Lock a record, attaching the access rules in the same call.
protected = privyq.protect(
    "Patient: John Doe. Plan: continue beta-blocker.",
    policy={"role": "doctor", "department": "cardiology", "purpose": "treatment", "expiry": "24h"},
    actor={"user_id": "dr_smith", "role": "doctor", "department": "cardiology"},
)

# Open it, only if the policy is satisfied.
result = privyq.access(protected, identity={"role": "doctor", "department": "cardiology", "purpose": "treatment"})
print(result.text)          # -> "Patient: John Doe. ..."
print(result.receipt.id)    # a signed, verifiable access receipt

# Verify the receipt cryptographically.
check = privyq.verify(result.receipt)
assert check.ok and check.signature_valid and check.chain_valid
```

Denied access raises `PolicyViolationError`, and the attempt is still recorded
as tamper-evident evidence:

```python
try:
    privyq.access(protected, identity={"role": "nurse"})
except privyq.PolicyViolationError as why:
    print(why)   # -> "policy violation: role condition failed ..."
```

## Installation

```bash
pip install privyq            # from PyPI (once published)
pip install -e ".[dev]"       # from this repo, with test/lint extras
```

The SDK talks to a running [PrivyQ core](../core-go) (`privyqd`). Point it at the
core with `configure(core_address=...)` or the `PRIVYQ_CORE_ADDRESS` env var.

## Policy shorthand

Policies accept two forms. The **shorthand** maps each key to a condition, lists
become `in`, `expiry` becomes a `before` with duration expansion (`"24h"` → an
absolute timestamp):

```python
{"role": "doctor", "department": ["cardiology", "oncology"], "expiry": "24h"}
```

The **structured** form is explicit and supports every operator (BP App D):

```python
{"conditions": [{"type": "role", "operator": "in", "value": ["doctor", "specialist"]}],
 "combination": "all"}
```

## API surface

| Function | Purpose |
|----------|---------|
| `configure(**opts)` | Set core address, default algorithms, timeout, TLS |
| `protect(data, policy, *, actor, key_id, algorithm)` | Encrypt with an embedded policy |
| `access(protected, identity, *, context)` | Decrypt if the policy allows; else raise |
| `verify(receipt)` | Verify a receipt's signature and chain linkage |
| `evidence.log(*, resource_id, actor_id, ...)` | Retrieve audit receipts |
| `generate_key / rotate_key / revoke_key` | Key lifecycle |

Exceptions follow a hierarchy rooted at `PrivyQError`
(`PolicyViolationError`, `KeyNotFoundError`, `CryptoError`, `CoreUnreachableError`, …).

## Configuration (ARCH §20.3)

| Env var | Default |
|---------|---------|
| `PRIVYQ_CORE_ADDRESS` | `localhost:50051` |
| `PRIVYQ_ALGORITHM` | `kyber_768` |
| `PRIVYQ_SIGNATURE` | `dilithium_3` |
| `PRIVYQ_TIMEOUT` | `5` |
| `PRIVYQ_AUDIT` | `true` |

## Development

```bash
pip install -e ".[dev]"
pytest -q          # unit tests + integration (builds & launches the real core)
black privyq
```

The gRPC stubs under `privyq/_proto/` are generated from
[`core-go/pkg/proto/privyq.proto`](../core-go/pkg/proto/privyq.proto). Regenerate
with `../scripts/gen-python-proto.sh` (or `make proto` at the repo root).
