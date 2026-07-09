"""Authentication: API key or JWT (ARCH §10.2).

When ``AUTH_ENABLED`` is false (the default for local/demo), requests pass
through. When enabled, an ``X-API-Key`` header or a ``Bearer`` JWT is required.
"""
from __future__ import annotations

from fastapi import Header, HTTPException, status
from jose import JWTError, jwt

from ..config import settings

# Demo API keys → identity. Production would source these from a store.
_API_KEYS = {"demo-key": {"user_id": "service", "role": "service"}}


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=detail)


async def authenticate(
    x_api_key: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> dict:
    """FastAPI dependency that returns the authenticated identity context."""
    if not settings.auth_enabled:
        return {}

    if x_api_key:
        identity = _API_KEYS.get(x_api_key)
        if identity is None:
            raise _unauthorized("invalid API key")
        return identity

    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1]
        try:
            claims = jwt.decode(token, settings.secret_key, algorithms=["HS256"])
        except JWTError as err:
            raise _unauthorized(f"invalid token: {err}") from err
        return claims

    raise _unauthorized("authentication required (X-API-Key or Bearer token)")
