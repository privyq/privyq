"""Thin service wrapper around the PrivyQ Python SDK (ARCH §10).

The gateway performs no cryptography itself; it validates/authenticates requests
and delegates to the SDK, which talks to the core over gRPC.
"""
from __future__ import annotations

import base64
from typing import Any

import privyq
from google.protobuf.json_format import MessageToDict, ParseDict
from privyq._proto import privyq_pb2 as pb

from ..config import settings

_configured = False


def _ensure_configured() -> None:
    global _configured
    if not _configured:
        privyq.configure(core_address=settings.core_address)
        _configured = True


def _evidence_dict(ev: pb.Evidence) -> dict[str, Any]:
    return MessageToDict(ev, preserving_proto_field_name=True)


def protect(data_b64: str, policy: dict, algorithm: str | None, key_id: str | None, resource_id: str, actor: dict | None):
    _ensure_configured()
    plaintext = base64.b64decode(data_b64)
    protected = privyq.protect(
        plaintext, policy, algorithm=algorithm, key_id=key_id, resource_id=resource_id, actor=actor
    )
    return {
        "protected_data": base64.b64encode(protected.raw).decode(),
        "metadata": {"key_id": protected.key_id, "algorithm": protected.algorithm, "policy_hash": protected.policy_hash},
        "evidence": _evidence_dict(protected.receipt._raw) if protected.receipt else {},
    }


def access(protected_data_b64: str, identity: dict, context: dict | None):
    _ensure_configured()
    raw = base64.b64decode(protected_data_b64)
    result = privyq.access(raw, identity, context=context)
    return {
        "data": base64.b64encode(result.data).decode(),
        "audit_evidence": _evidence_dict(result.receipt._raw),
    }


def verify(evidence: dict, reevaluate: bool):
    _ensure_configured()
    client = privyq.client.get_default_client()
    ev = pb.Evidence()
    ParseDict(evidence, ev, ignore_unknown_fields=True)
    resp = client.call("VerifyEvidence", pb.VerifyEvidenceRequest(evidence=ev, reevaluate_policy=reevaluate))
    return {
        "verified": resp.verified,
        "signature_valid": resp.signature_valid,
        "chain_valid": resp.chain_valid,
        "policy_compliant": resp.policy_compliant,
        "detail": resp.detail,
    }


def evidence_log(resource_id: str, actor_id: str, page: int, page_size: int):
    _ensure_configured()
    client = privyq.client.get_default_client()
    resp = client.call(
        "GetEvidenceLog",
        pb.GetEvidenceLogRequest(resource_id=resource_id, actor_id=actor_id, page=page, page_size=page_size),
    )
    return {
        "entries": [_evidence_dict(e) for e in resp.entries],
        "total": resp.total,
        "page": resp.page or page,
        "page_size": resp.page_size or page_size,
        "verified": resp.chain_verified,
    }


def generate_key(req: dict):
    _ensure_configured()
    key = privyq.generate_key(
        algorithm=req.get("algorithm"),
        key_type=req.get("type", "encryption"),
        organization=req.get("organization", ""),
        owner=req.get("owner", ""),
        metadata=req.get("metadata", {}),
    )
    return {
        "key_id": key.key_id, "public_key": key.public_key, "algorithm": key.algorithm,
        "type": key.type, "status": key.status, "created_at": key.created_at,
    }


def rotate_key(key_id: str):
    _ensure_configured()
    resp = privyq.rotate_key(key_id)
    return {"old_key_id": resp.old_key_id, "new_key_id": resp.new_key_id, "rotated_at": resp.rotated_at}


def revoke_key(key_id: str):
    _ensure_configured()
    resp = privyq.revoke_key(key_id)
    return {"key_id": resp.key_id, "revoked_at": resp.revoked_at}


def health():
    _ensure_configured()
    client = privyq.client.get_default_client()
    resp = client.call("Health", pb.HealthRequest())
    return {"status": resp.status, "services": dict(resp.services), "version": resp.version}
