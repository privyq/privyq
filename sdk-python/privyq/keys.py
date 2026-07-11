"""Key management wrappers (BP §11.2, §16)."""

from __future__ import annotations

from typing import Any, Mapping

from ._proto import privyq_pb2 as pb
from .client import Client, get_default_client
from .config import get_config


def generate_key(
    *,
    algorithm: str | None = None,
    key_type: str = "encryption",
    organization: str = "",
    owner: str = "",
    metadata: Mapping[str, Any] | None = None,
    client: Client | None = None,
):
    client = client or get_default_client()
    req = pb.GenerateKeyRequest(
        algorithm=algorithm or get_config().default_algorithm,
        type=key_type,
        organization=organization,
        owner=owner,
        metadata={str(k): str(v) for k, v in (metadata or {}).items()},
    )
    return client.call("GenerateKey", req).key


def get_key(key_id: str, *, client: Client | None = None):
    """Fetch public key info by id (the v2 ``get_key`` verb; core ``GetPublicKey``)."""
    client = client or get_default_client()
    return client.call("GetPublicKey", pb.GetPublicKeyRequest(key_id=key_id)).key


def rotate_key(key_id: str, *, grace_period: str = "24h", client: Client | None = None):
    client = client or get_default_client()
    return client.call("RotateKey", pb.RotateKeyRequest(key_id=key_id, grace_period=grace_period))


def revoke_key(key_id: str, *, reason: str = "", client: Client | None = None):
    client = client or get_default_client()
    return client.call("RevokeKey", pb.RevokeKeyRequest(key_id=key_id, reason=reason))
