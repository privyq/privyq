# Contributing to PrivyQ

Thanks for your interest in PrivyQ. This guide covers how to get set up and the
standards we hold code to (ARCH §27).

## Development setup

Prerequisites: **Go 1.24+**, **Python 3.10+**, **Node 18+**, Docker (for the
full stack), and `protoc` with `protoc-gen-go`/`protoc-gen-go-grpc` if you
regenerate stubs.

```bash
git clone https://github.com/privyq/privyq.git
cd privyq
make dev          # full stack via docker-compose
# or per component — see each component's README
```

## Repository model

PrivyQ is a **monorepo**. The gRPC contract (`core-go/pkg/proto/privyq.proto`) is
the source of truth for the SDK↔core boundary; the gateway's exported OpenAPI
spec is the source of truth for the frontend↔gateway boundary. If you change a
contract, regenerate the stubs (`make proto`) and update all consumers in the
same PR.

## Coding standards

| Language | Format | Lint | Tests |
|----------|--------|------|-------|
| Go | `gofmt` | `go vet` | `go test ./...` |
| Python | `black` | `pylint` | `pytest` |
| TypeScript | `prettier` | `eslint` | `vitest` / Playwright |

- **All code ships with tests.** Bug fixes include a regression test.
- **Never hand-roll cryptography.** Use the `kem`/`signatures` interfaces and
  vetted libraries. Policy evaluation and decryption happen only in the core.
- Keep the layers honest: the SDK, gateway, and frontend must not perform
  cryptography or policy decisions themselves.

## Commits & pull requests

- Follow [Conventional Commits](https://www.conventionalcommits.org)
  (`feat:`, `fix:`, `docs:`, `test:`, `refactor:`, …).
- One logical change per PR; keep the description focused on *why*.
- PRs must pass CI (lint + tests for every affected component) and get at least
  one review.
- Update `docs/` and the relevant README when behavior or configuration changes.

