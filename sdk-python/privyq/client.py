"""gRPC client wrapper around the PrivyQ core (ARCH §8, §9).

Maintains a persistent channel and maps gRPC status codes to SDK exceptions
(ARCH §21.3). A module-level default client is created lazily from the global
configuration; ``configure()`` resets it.
"""

from __future__ import annotations

import grpc

from . import exceptions as exc
from ._proto import privyq_pb2_grpc as pb_grpc
from .config import Config, get_config

_STATUS_MAP = {
    grpc.StatusCode.PERMISSION_DENIED: exc.PolicyViolationError,
    grpc.StatusCode.NOT_FOUND: exc.KeyNotFoundError,
    grpc.StatusCode.ABORTED: exc.KeyRevokedError,
    grpc.StatusCode.DEADLINE_EXCEEDED: exc.TimeoutError_,
    grpc.StatusCode.UNAVAILABLE: exc.CoreUnreachableError,
}


def _translate(err: grpc.RpcError) -> exc.PrivyQError:
    code = err.code()
    detail = err.details() or str(err)
    return _STATUS_MAP.get(code, exc.PrivyQError)(detail)


class Client:
    """A connection to the PrivyQ core."""

    def __init__(self, config: Config | None = None):
        self.config = config or get_config()
        if self.config.tls:
            creds = grpc.ssl_channel_credentials(
                root_certificates=_read(self.config.tls_ca) if self.config.tls_ca else None
            )
            self._channel = grpc.secure_channel(self.config.core_address, creds)
        else:
            self._channel = grpc.insecure_channel(self.config.core_address)
        self.stub = pb_grpc.PrivyQCoreStub(self._channel)

    def call(self, method_name: str, request):
        """Invoke a stub method, translating gRPC errors to SDK exceptions."""
        method = getattr(self.stub, method_name)
        try:
            return method(request, timeout=self.config.timeout_seconds)
        except grpc.RpcError as err:  # pragma: no cover - exercised via integration
            raise _translate(err) from err

    def close(self) -> None:
        self._channel.close()


def _read(path: str) -> bytes:
    with open(path, "rb") as fh:
        return fh.read()


_default_client: Client | None = None


def get_default_client() -> Client:
    global _default_client
    if _default_client is None:
        _default_client = Client(get_config())
    return _default_client


def reset_default_client() -> None:
    global _default_client
    if _default_client is not None:
        _default_client.close()
    _default_client = None
