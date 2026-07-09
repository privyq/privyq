"""verify() — check a receipt / audit evidence entry (BP §11.2)."""

from __future__ import annotations

from .client import Client, get_default_client
from .models import Receipt, VerificationResult


def verify(evidence: Receipt, *, reevaluate: bool = True, client: Client | None = None) -> VerificationResult:
    """Verify a :class:`Receipt`'s signature and chain linkage."""
    client = client or get_default_client()
    from ._proto import privyq_pb2 as pb

    req = pb.VerifyEvidenceRequest(evidence=evidence._raw, reevaluate_policy=reevaluate)
    resp = client.call("VerifyEvidence", req)
    return VerificationResult(
        ok=resp.verified,
        signature_valid=resp.signature_valid,
        chain_valid=resp.chain_valid,
        policy_compliant=resp.policy_compliant,
        detail=resp.detail,
    )
