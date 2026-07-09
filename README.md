<div align="center">

# PrivyQ

**Lock it. Rule it. Prove it.**

Post-quantum encryption that carries its own access rules and hands you
tamper-proof receipts for every access.

[Architecture](docs/SYSTEM_ARCHITECTURE.md) ·
[Blueprint](docs/blueprint.md) ·
[License](LICENSE)

</div>

---

## Why PrivyQ

Encryption keeps data confidential, but it says nothing about *who* may open it,
*under what conditions*, or *whether that access was ever allowed*. And the
public-key cryptography most systems rely on today will not survive a
cryptographically relevant quantum computer.

PrivyQ closes both gaps at once. It is a developer-centric framework that binds a
**privacy policy to the ciphertext itself**, enforces that policy **before**
decryption using **post-quantum cryptography**, and records every access as
**cryptographically verifiable evidence** that cannot be altered undetected.

Three contributions, one framework:

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
