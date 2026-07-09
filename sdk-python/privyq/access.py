"""access() — decrypt data if the embedded policy is satisfied (BP §11.2)."""

from __future__ import annotations

from typing import Any, Mapping

from ._proto import privyq_pb2 as pb
from .client import Client, get_default_client
from .models import AccessResult, ProtectedData, Receipt
from .policies import to_proto_identity


def access(
    protected: ProtectedData | bytes,
    identity: Mapping[str, Any],
    *,
    context: Mapping[str, Any] | None = None,
    client: Client | None = None,
) -> AccessResult:
    """Attempt to decrypt ``protected`` as ``identity``.

    Raises :class:`privyq.PolicyViolationError` if the policy denies access; the
    denied attempt is still recorded as evidence in the core.
    """
    client = client or get_default_client()
    raw = protected.to_bytes() if isinstance(protected, ProtectedData) else protected
    ctx = context or {}
    req = pb.AccessRequest(
        protected_data=raw,
        identity=to_proto_identity(identity),
        context=pb.Context(
            timestamp=ctx.get("timestamp", ""),
            ip_address=ctx.get("ip_address", ""),
            session_id=ctx.get("session_id", ""),
            user_agent=ctx.get("user_agent", ""),
        ),
    )
    resp = client.call("Access", req)
    return AccessResult(data=resp.data, receipt=Receipt.from_pb(resp.evidence))
