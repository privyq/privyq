<div align="center">

# PrivyQ

**Describe your access policies. Let PrivyQ enforce them.**

The trust-infrastructure SDK developers rely on to make security decisions
correctly — policy/attribute-based access control, policy-bound post-quantum
encryption, and tamper-evident audit, behind a few intention-based verbs.

[v2 Blueprint](docs/v2_blueprint.md) ·
[Architecture](docs/SYSTEM_ARCHITECTURE.md) ·
[License](LICENSE)

</div>

---

## Why PrivyQ

Every non-trivial app re-implements authorization inline — `if role…`, `if
department…`, `if owner…`, `if expiry…` — smeared across dozens of endpoints and
services, inconsistent and unauditable. Most breaches are broken governance, not
broken crypto.

PrivyQ lets you **describe the policy once** and stop hand-writing the
authorization engine that enforces it. You still own your business rules; PrivyQ
owns the decision — evaluating **attributes** (not just roles: purpose, shift,
jurisdiction, approval-limit, wallet, …) so it is strictly more expressive than
RBAC. And because it *also* binds the policy to the ciphertext with
**post-quantum encryption** and records every decision as **verifiable evidence**,
one layer answers *who can access this?*, *should they?*, and *prove it.*

```python
decision = privyq.check(user, invoice)     # no data revealed — just the decision
# Decision(allowed=False, reason="Role 'Reviewer' cannot approve above ₦5,000,000.")
record = privyq.access(invoice, user)      # authorized + revealed, or denied with a reason
```

> **v2** repositions PrivyQ from a post-quantum thesis into a trust-infrastructure
> product. The authoritative spec is **[docs/v2_blueprint.md](docs/v2_blueprint.md)**;
> the v1 thesis line is preserved on the `HOD` branch.

Its foundational contributions, still true:

1. **Policy-Governed Post-Quantum Encryption** — the rules travel *inside* the
   encrypted data (role, department, purpose, classification, expiry,
   jurisdiction, …) and are evaluated at access time. Hybrid Kyber + AES-256-GCM.
2. **Cryptographically Verifiable Privacy Evidence** — every access, granted or
   denied, produces a Dilithium-signed, hash-chained audit entry. Editing,
   deleting, forging, or reordering the log is detectable.
3. **A Developer-Centric API** — `protect()`, `access()`, `verify()`. No
   cryptographic expertise required.

```python
from privyq import protect, access

protected = protect(
    data=patient_record,
    policy={"role": "doctor", "department": "cardiology", "purpose": "treatment", "expiry": "24h"},
)

result = access(protected, identity={"role": "doctor", "department": "cardiology"})
print(result.data)          # decrypted — the policy was satisfied
print(result.receipt.id)    # a signed, verifiable access receipt
```

## Architecture

A strict layered stack. Each layer talks only to its neighbour; the Go core is
the only place cryptography or policy evaluation ever happens.

```
Next.js frontend ──HTTPS──▶ FastAPI gateway ──▶ Python SDK ──gRPC──▶ Go core ──▶ CIRCL / liboqs
   (demo UI)                (REST, auth, RL)    (protect/access)   (crypto,       (Kyber,
                                                                   policy, audit,  Dilithium)
                                                                   key mgmt)
                        PostgreSQL — keys · policies · resources · evidence chain
```

| Component | Language | Role |
|-----------|----------|------|
| [`core-go`](core-go) | Go | All PQC, policy evaluation, audit chaining, key management |
| [`sdk-python`](sdk-python) | Python | Intention-based developer API over gRPC |
| [`gateway`](gateway) | Python (FastAPI) | REST API, authentication, rate limiting, OpenAPI |
| [`frontend`](frontend) | TypeScript (Next.js) | Interactive medical-records demonstration |

Full detail lives in [`docs/SYSTEM_ARCHITECTURE.md`](docs/SYSTEM_ARCHITECTURE.md)
and [`docs/blueprint.md`](docs/blueprint.md).

## Repository layout

```
core-go/       cryptographic core (Go)             gateway/    REST gateway (FastAPI)
sdk-python/    developer SDK (Python)              frontend/   demo app (Next.js)
docs/          specifications & API reference      deploy/     docker-compose + kubernetes
tests/         cross-component integration & e2e   examples/   worked examples
```

> **Project status:** under active development, built to the specification in
> `docs/`. The design documents there are the source of truth for the system's
> behavior and architecture.

## Getting started

The full stack runs with Docker:

```bash
git clone https://github.com/privyq/privyq.git
cd privyq
make dev          # brings up core + gateway + frontend + postgres
```

Or work on a single component — each has its own README with build and test
instructions:
[core-go](core-go/README.md) ·
[sdk-python](sdk-python/README.md) ·
[gateway](gateway/README.md) ·
[frontend](frontend/README.md).

## Security

PrivyQ is applied cryptography; we take reports seriously. Please see
[`SECURITY.md`](SECURITY.md) for how to report a vulnerability, and BP §26 in the
blueprint for a candid discussion of current limitations. Do not use the
development key-store defaults in production.

## Contributing

Contributions are welcome — see [`CONTRIBUTING.md`](CONTRIBUTING.md). All code
ships with tests; Go is `gofmt`-clean and Python is `black`/`pylint`-clean.

## License

MIT © PrivyQ Contributors. See [`LICENSE`](LICENSE).
