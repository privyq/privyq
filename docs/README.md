# PrivyQ Documentation

The authoritative specification and reference material for PrivyQ.

## Specifications (source of truth)

- **[blueprint.md](blueprint.md)** — the *what and why*: motivation, the three
  research contributions, cryptographic foundations, component responsibilities,
  data structures (App A), the full REST API (App B), algorithm tables (App C),
  and the policy schema (App D).
- **[SYSTEM_ARCHITECTURE.md](SYSTEM_ARCHITECTURE.md)** — the *how*: repository
  layout, the gRPC contract, per-component design, database schema, data-flow and
  sequence diagrams, the security model, deployment, and testing strategy.

Implementation follows these documents.

## Reference

- **[api/openapi.json](api/openapi.json)** — the gateway's OpenAPI spec (the
  contract the frontend's typed client is generated from).
- **[BENCHMARKS.md](BENCHMARKS.md)** — measured performance vs the targets.

## Component guides

Each component has its own README with build/run/test instructions:

| Component | Guide |
|-----------|-------|
| Cryptographic core (Go) | [`../core-go/README.md`](../core-go/README.md) |
| Python SDK | [`../sdk-python/README.md`](../sdk-python/README.md) |
| FastAPI gateway | [`../gateway/README.md`](../gateway/README.md) |
| Next.js frontend | [`../frontend/README.md`](../frontend/README.md) |

## Getting started

See the [root README](../README.md). In short: `make dev` brings up the whole
stack (core + gateway + frontend + PostgreSQL) via Docker.
