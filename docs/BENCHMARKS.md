# PrivyQ Benchmarks

Performance evaluation against the targets in `blueprint.md` §19.1 and
`SYSTEM_ARCHITECTURE.md` §24.3.

## Core cryptographic operations (measured)

Go microbenchmarks on the cryptographic core (`core-go`), 20-core x86-64,
Kyber-768 + Dilithium-3 + AES-256-GCM, in-memory storage:

```
go test ./internal/core -bench . -benchmem -run xxx
```

| Operation | Measured (ns/op) | Measured (ms) | Target (ARCH §24.3) | Result |
|-----------|------------------|---------------|---------------------|--------|
| `Protect` (encrypt + policy + evidence) | 658,951 | ~0.66 ms | Protect 1KB < 15 ms (p95) | ✅ 22× headroom |
| `Access` (policy eval + decrypt + evidence) | 415,858 | ~0.42 ms | Access 1KB < 20 ms (p95) | ✅ 47× headroom |
| `VerifyEvidence` (signature + chain) | 81,061 | ~0.08 ms | Verify single < 5 ms (p95) | ✅ 60× headroom |

Every core operation is well within target — the post-quantum primitives (CIRCL
ML-KEM/ML-DSA) are fast enough that policy evaluation and audit chaining add
negligible overhead, as predicted in BP §19.

Reproduce: `cd core-go && go test ./internal/core -bench . -benchmem -run xxx`.

## Gateway load test (script)

End-to-end throughput/latency over REST is measured with
[k6](https://k6.io) against a running stack:

```bash
make dev                                   # bring up core + gateway + db
k6 run tests/perf/gateway_load.js          # ramps 10 → 50 → 100 VUs (BP §24.3 Scenario 3)
```

The script asserts `http_req_duration p(95) < 50 ms` and `http_req_failed < 1%`,
mirroring the concurrency table in BP §24.3. Recorded results from a full stack
run should be pasted here once executed in the target environment.

## Methodology

- Core benchmarks use Go's `testing.B` with `-benchmem`; each measures a single
  logical operation on a warm service with in-memory stores, isolating crypto +
  policy + audit cost from I/O.
- Gateway/k6 numbers additionally include HTTP, JSON (de)serialization, the SDK
  gRPC hop, and (when `DB_URL` is set) PostgreSQL writes for the evidence chain.
