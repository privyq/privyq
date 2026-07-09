"""Token-bucket rate limiting + structured request logging (ARCH §10.3, §22)."""
from __future__ import annotations

import json
import sys
import time
from collections import defaultdict

from fastapi import Request
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from ..config import settings


class _Bucket:
    __slots__ = ("tokens", "updated")

    def __init__(self, capacity: float):
        self.tokens = capacity
        self.updated = time.monotonic()


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Per-client (IP or API key) token bucket."""

    def __init__(self, app):
        super().__init__(app)
        self.rate = settings.rate_limit_per_sec
        self.capacity = settings.rate_limit_burst
        self._buckets: dict[str, _Bucket] = defaultdict(lambda: _Bucket(self.capacity))

    def _client_id(self, request: Request) -> str:
        return request.headers.get("x-api-key") or (request.client.host if request.client else "unknown")

    async def dispatch(self, request: Request, call_next):
        b = self._buckets[self._client_id(request)]
        now = time.monotonic()
        b.tokens = min(self.capacity, b.tokens + (now - b.updated) * self.rate)
        b.updated = now
        if b.tokens < 1:
            return JSONResponse(
                status_code=429,
                content={"error": {"code": "RATE_LIMITED", "message": "Too many requests",
                                    "details": {}, "timestamp": _now_iso()}},
            )
        b.tokens -= 1
        return await call_next(request)


class LoggingMiddleware(BaseHTTPMiddleware):
    """Emit one structured JSON log line per request (ARCH §22.2)."""

    async def dispatch(self, request: Request, call_next):
        start = time.monotonic()
        response = await call_next(request)
        line = {
            "timestamp": _now_iso(),
            "level": "info",
            "service": "gateway",
            "method": request.method,
            "path": request.url.path,
            "status": response.status_code,
            "duration_ms": round((time.monotonic() - start) * 1000, 2),
        }
        print(json.dumps(line), file=sys.stdout, flush=True)
        return response


def _now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
