# PrivyQ Gateway (`gateway`)

A FastAPI REST gateway over PrivyQ. It exposes the `protect` / `access` /
`verify` / `evidence` / `keys` operations as HTTP endpoints for services that
prefer REST over the gRPC SDK, and it is what the Next.js demo talks to.

The gateway performs **no cryptography itself** — it validates and authenticates
requests, then delegates to the [Python SDK](../sdk-python), which talks to the
[Go core](../core-go) over gRPC.

## Endpoints (BP App B, ARCH §10.1)

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/v1/protect` | Encrypt data with an embedded policy |
| POST | `/api/v1/access` | Decrypt if the policy allows (403 on denial) |
| POST | `/api/v1/verify` | Verify an audit evidence entry |
| GET | `/api/v1/evidence/log` | Retrieve audit evidence for a resource/actor |
| POST | `/api/v1/keys/generate` | Generate a key pair |
| POST | `/api/v1/keys/rotate/{id}` | Rotate a key |
| POST | `/api/v1/keys/revoke/{id}` | Revoke a key |
| GET | `/api/v1/health` | Health, incl. core reachability |
| GET | `/docs` | Interactive OpenAPI docs (auto-generated) |

The OpenAPI schema is also exported to
[`../docs/api/openapi.json`](../docs/api/openapi.json); the frontend generates its
typed client from it.

## Run

```bash
pip install -r requirements.txt        # includes the local SDK
uvicorn app.main:app --reload --port 8000
# open http://localhost:8000/docs
```

Requires a running [`privyqd`](../core-go) core (set `CORE_ADDRESS`).

## Configuration (ARCH §20.2)

| Env var | Description | Default |
|---------|-------------|---------|
| `CORE_ADDRESS` | gRPC address of the core | `localhost:50051` |
| `SECRET_KEY` | JWT signing key | `change-me-…` |
| `AUTH_ENABLED` | Require API key / JWT | `false` |
| `RATE_LIMIT_PER_SEC` | Token-bucket refill rate per client | `100` |
| `RATE_LIMIT_BURST` | Token-bucket capacity | `200` |

## Authentication (ARCH §10.2)

When `AUTH_ENABLED=true`, every request needs an `X-API-Key` header or a
`Bearer` JWT. When disabled (the default for local/demo), requests pass through.

## Errors (ARCH §21)

Errors use a structured envelope with a stable code:

```json
{ "error": { "code": "FORBIDDEN", "message": "policy violation: role condition failed",
             "details": {}, "timestamp": "2026-01-01T12:00:00Z" } }
```

Policy denials map to `403 FORBIDDEN`, missing keys to `404 NOT_FOUND`, an
unreachable core to `503`, and rate-limited clients to `429`.

## Development

```bash
pip install -r requirements.txt -r requirements-dev.txt
pytest -q     # spins up a real core and exercises the full REST → SDK → core path
```
