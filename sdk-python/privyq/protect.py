"""protect() — encrypt data with an embedded policy (BP §11.2)."""

from __future__ import annotations

from typing import Any, Mapping

from ._proto import privyq_pb2 as pb
from .client import Client, get_default_client
from .config import get_config
from .models import ProtectedData, Receipt
from .policies import to_proto_identity, to_proto_policy


def protect(
    data: bytes | str,
    policy: Mapping[str, Any] | None = None,
    *,
    key_id: str | None = None,
    algorithm: str | None = None,
    resource_id: str = "",
    actor: Mapping[str, Any] | None = None,
    client: Client | None = None,
) -> ProtectedData:
    """Encrypt ``data`` under ``policy`` and return a :class:`ProtectedData`.

    The policy travels inside the ciphertext and is enforced at access time.
    """
    client = client or get_default_client()
    if isinstance(data, str):
        data = data.encode("utf-8")
    req = pb.ProtectRequest(
        plaintext=data,
        policy=to_proto_policy(policy),
        algorithm=algorithm or get_config().default_algorithm,
        key_id=key_id or "",
        resource_id=resource_id,
        actor=to_proto_identity(actor),
    )
    resp = client.call("Protect", req)
    return ProtectedData(
        raw=resp.protected_data,
        key_id=resp.key_id,
        algorithm=resp.algorithm,
        policy_hash=resp.policy_hash,
        receipt=Receipt.from_pb(resp.evidence) if resp.HasField("evidence") else None,
    )
