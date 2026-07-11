# PrivyQ Cryptographic Core (`core-go`)

The cryptographic heart of PrivyQ. This is the **only** component that performs
cryptography, evaluates policies, and mints audit evidence — every other layer
(SDK, gateway, frontend) is a wrapper around the gRPC service defined here.

It implements the three PrivyQ contributions at their lowest level:

- **Policy-governed post-quantum encryption** — hybrid Kyber (KEM) + AES-256-GCM,
  with the access policy bound to the ciphertext and evaluated before decryption.
- **Verifiable privacy evidence** — every access is recorded as a Dilithium-signed,
  SHA-256 hash-chained audit entry; tampering, deletion, and reordering are all detectable.
- **A clean gRPC contract** — `pkg/proto/privyq.proto`, the frozen interface for every SDK.

## Cryptographic backend

PrivyQ has two pluggable PQC backends, selected at runtime by `PQC_BACKEND`:

- **`circl` (default).** Post-quantum primitives from
  [Cloudflare CIRCL](https://github.com/cloudflare/circl) — a pure-Go, NIST-standardized
  implementation of ML-KEM (Kyber), ML-DSA (Dilithium), and SLH-DSA (SPHINCS+). The default
  build **has no C dependencies or CGO** — `go build ./...` just works. This is what a stock
  container ships with.
- **`liboqs` (optional, CGO).** The [Open Quantum Safe](https://github.com/open-quantum-safe/liboqs)
  reference library, compiled in only with `-tags liboqs`. It adds **Falcon (FN-DSA)** — which
  CIRCL does not provide — and gives reference-library parity. Selecting `PQC_BACKEND=liboqs`
  in a build that did not compile it in fails with a clear error rather than falling back.

The `kem.Scheme` / `signatures.Scheme` interfaces and a small backend registry
(`internal/kem`, `internal/signatures`) mean callers never know which backend answered.

> **Honesty note:** earlier design docs described liboqs as *the* backend. In reality the
> default is CIRCL (the standardized ML-KEM/ML-DSA/SLH-DSA); liboqs is opt-in and the only
> way to get Falcon. Both are documented here as they actually are.

### Building/running with liboqs

```bash
# install liboqs so pkg-config can find it (any prefix works)
#   e.g. cmake -S liboqs -B build -DBUILD_SHARED_LIBS=ON -DCMAKE_INSTALL_PREFIX=$HOME/.local
#        cmake --build build --target install
export PKG_CONFIG_PATH=$HOME/.local/lib/pkgconfig
export LD_LIBRARY_PATH=$HOME/.local/lib          # so the .so loads at runtime
go build -tags liboqs ./...
go test  -tags liboqs ./...                       # exercises Falcon + ML-KEM via liboqs
PQC_BACKEND=liboqs ./privyqd                       # run the daemon on the liboqs backend
```

## Layout

```
cmd/privyqd/        daemon entrypoint (gRPC server, env-driven config)
internal/
  kem/              ML-KEM (Kyber) — circl + optional liboqs backends
  signatures/       ML-DSA (Dilithium) + SLH-DSA (SPHINCS+); Falcon via the liboqs backend
  encryption/       hybrid encryption: KEM-encapsulated AES-256-GCM
  policies/         the Policy Decision Engine — condition registry + operators
  audit/            evidence generation, hash-chaining, verification, chain store
  keymanager/       key lifecycle, org→dept→user hierarchy, storage backends
  core/             orchestration: Protect / Access / Sign / Verify / evidence flows
  grpc/             gRPC server: protobuf ↔ domain translation only
pkg/
  proto/            privyq.proto — the frozen SDK↔core contract
  pb/               generated Go stubs
  types/            hand-written domain model
```

## Build & test

Requires Go 1.24+ (no other system dependencies).

```bash
make build     # -> bin/privyqd
make test      # unit tests
make cover     # tests + total coverage
make proto     # regenerate stubs (needs protoc + protoc-gen-go[-grpc])
```

## Run

```bash
make run
# or with configuration:
GRPC_PORT=50051 KEY_STORAGE=local KEY_STORAGE_PATH=./data/keys ./bin/privyqd
```

gRPC reflection is enabled, so you can drive it manually with
[`grpcurl`](https://github.com/fullstorydev/grpcurl):

```bash
grpcurl -plaintext localhost:50051 privyq.v1.PrivyQCore/Health
```

## Configuration (ARCH §20.1)

| Variable | Description | Default |
|----------|-------------|---------|
| `GRPC_PORT` | gRPC listen port | `50051` |
| `KEY_STORAGE` | `memory` or `local` (HSM/cloud-KMS are future backends) | `local` |
| `KEY_STORAGE_PATH` | directory for the local encrypted key store | `./data/keys` |
| `KEY_MASTER_PASSWORD` | master password for the local key store | `privyq-dev-master` |
| `TLS_CERT` / `TLS_KEY` | enable TLS when both are set | (off) |

## Security notes & limitations

- The local file key store encrypts keys at rest with AES-256-GCM under a
  master password stretched via SHA-256. This is for **development and small
  deployments** — production should use an HSM or cloud KMS backend
  (interfaces are in place; implementations are future work, BP §26/§27).
- Private keys never leave this process. Policy evaluation and decryption happen
  only here.
- PQC algorithms are comparatively new (BP §26.1); the CIRCL implementations track
  the finalized NIST standards.
- The in-memory evidence store is not durable; PostgreSQL persistence lands in
  the DB phase (ARCH §12).

See the repository [`docs/`](../docs) for the full architecture and threat model.
