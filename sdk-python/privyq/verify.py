"""verify() — check audit evidence OR a post-quantum seal (blueprint §5).

``verify`` dispatches on its argument:
  - ``verify(receipt)`` verifies an evidence entry's signature + chain.
  - ``verify(sealed, data=...)`` verifies a :class:`~privyq.seal.Sealed` signature
    against the original ``data``.
"""

from __future__ import annotations

from typing import Any

from .client import Client, get_default_client
from .models import Receipt, VerificationResult
from .seal import Sealed


def verify(
    target: Receipt | Sealed,
    *,
    data: bytes | None = None,
    reevaluate: bool = True,
    client: Client | None = None,
) -> VerificationResult:
    """Verify an evidence :class:`Receipt` or a :class:`Sealed` signature."""
    client = client or get_default_client()
    from ._proto import privyq_pb2 as pb

    if isinstance(target, Sealed):
        if data is None:
            raise ValueError("verify(sealed) requires the original data= to check against")
        resp = client.call("VerifySeal", pb.VerifySealRequest(data=data, sealed=target.to_pb()))
        return VerificationResult(ok=resp.valid, signature_valid=resp.valid,
                                  chain_valid=True, policy_compliant=True, detail=resp.detail)

    req = pb.VerifyEvidenceRequest(evidence=target._raw, reevaluate_policy=reevaluate)
    resp = client.call("VerifyEvidence", req)
    return VerificationResult(
        ok=resp.verified, signature_valid=resp.signature_valid, chain_valid=resp.chain_valid,
        policy_compliant=resp.policy_compliant, detail=resp.detail,
    )
