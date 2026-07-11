"""PrivyQ FastAPI gateway — REST surface over the SDK/core (ARCH §10, BP §12)."""
from __future__ import annotations

import time

import privyq
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import settings
from .middleware.ratelimit import LoggingMiddleware, RateLimitMiddleware
from .routes import access, decision, evidence, health, keys, policy, protect, verify

app = FastAPI(
    title="PrivyQ Gateway",
    version=settings.version,
    description="REST API for policy-governed post-quantum encryption with verifiable evidence.",
)

app.add_middleware(RateLimitMiddleware)
app.add_middleware(LoggingMiddleware)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_API = "/api/v1"
for module in (protect, access, verify, evidence, keys, policy, decision, health):
    app.include_router(module.router, prefix=_API)


# ── Error handling (ARCH §21.1–21.2) ──

_ERROR_CODES = {
    privyq.PolicyViolationError: (403, "FORBIDDEN"),
    privyq.KeyNotFoundError: (404, "NOT_FOUND"),
    privyq.KeyRevokedError: (409, "CONFLICT"),
    privyq.CoreUnreachableError: (503, "CORE_UNREACHABLE"),
    privyq.CryptoError: (500, "INTERNAL_ERROR"),
}


def _error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": {"code": code, "message": message, "details": {},
                           "timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())}},
    )


@app.exception_handler(privyq.PrivyQError)
async def privyq_error_handler(_request: Request, exc: privyq.PrivyQError):
    for exc_type, (status_code, code) in _ERROR_CODES.items():
        if isinstance(exc, exc_type):
            return _error(status_code, code, str(exc))
    return _error(500, "INTERNAL_ERROR", str(exc))


@app.get("/", include_in_schema=False)
async def root():
    return {"name": "PrivyQ Gateway", "version": settings.version, "docs": "/docs"}
