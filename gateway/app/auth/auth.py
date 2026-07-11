"""Authentication: API key or JWT/OAuth2 bearer (ARCH §10.2).

When ``AUTH_ENABLED`` is false (the default for local/demo), requests pass
through. When enabled, an ``X-API-Key`` header or a ``Bearer`` token is required.

API keys are sourced from a **store**, not hardcoded (v2: closes gap C4):

- ``PRIVYQ_API_KEYS`` — a JSON object mapping api-key -> identity dict, e.g.
  ``{"k_live_...": {"user_id": "svc", "role": "service", "tenant_id": "acme"}}``
- ``PRIVYQ_API_KEYS_FILE`` — a path to a file containing that same JSON.

Bearer tokens are validated as JWTs (the OAuth2 bearer flow); each principal
carries a ``tenant_id`` (default ``"default"``) so requests are tenant-scoped.
Mutual TLS for internal service-to-service calls is terminated at the transport
(uvicorn/ingress) and is orthogonal to this dependency.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from ..config import settings


@lru_cache(maxsize=1)
def _api_key_store() -> dict[str, dict]:
    raw = os.getenv("PRIVYQ_API_KEYS", "")
    if not raw and os.getenv("PRIVYQ_API_KEYS_FILE"):
        try:
            with open(os.environ["PRIVYQ_API_KEYS_FILE"], encoding="utf-8") as fh:
                raw = fh.read()
        except OSError:
            raw = ""
    if not raw:
        return {}
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        return {}
    for ident in data.values():
        ident.setdefault("tenant_id", "default")
    return data


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


async def authenticate(
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """FastAPI dependency that returns the authenticated identity context."""
    if not settings.auth_enabled:
        return {"tenant_id": "default"}

    if x_api_key:
        identity = _api_key_store().get(x_api_key)
        if identity is None:
            raise _unauthorized("invalid API key")
        return identity

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            claims = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        except JWTError as err:
            raise _unauthorized(f"invalid token: {err}") from err
        claims.setdefault("tenant_id", "default")
        return claims

    raise _unauthorized("authentication required (X-API-Key or Bearer token)")
