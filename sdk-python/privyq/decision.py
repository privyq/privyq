"""check() / explain() — the v2 authorization decision (blueprint §5, §6).

``check`` is the pure decision: it never reveals data. Pass a ``ProtectedData``
(or raw bytes) whose embedded policy is evaluated, or an explicit ``policy`` dict.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, List, Mapping

from ._proto import privyq_pb2 as pb
from .client import Client, get_default_client
from .models import ProtectedData
from .policies import to_proto_identity, to_proto_policy


@dataclass
class Decision:
    """A self-explaining authorization decision."""

    allowed: bool
    reason: str = ""
    matched: List[str] = field(default_factory=list)
    failed: List[str] = field(default_factory=list)
    obligations: List[str] = field(default_factory=list)
    policy_id: str = ""
    evaluated_at: str = ""

    @classmethod
    def from_pb(cls, d: pb.Decision) -> "Decision":
        return cls(
            allowed=d.allowed, reason=d.reason, matched=list(d.matched),
            failed=list(d.failed), obligations=list(d.obligations),
            policy_id=d.policy_id, evaluated_at=d.evaluated_at,
        )

    def __bool__(self) -> bool:
        return self.allowed


def check(
    identity: Mapping[str, Any],
    resource: ProtectedData | bytes | None = None,
    *,
    policy: Mapping[str, Any] | None = None,
    context: Mapping[str, Any] | None = None,
    emit_evidence: bool = False,
    client: Client | None = None,
) -> Decision:
    """Decide whether ``identity`` may access ``resource`` (or satisfies ``policy``)."""
    client = client or get_default_client()
    req = pb.CheckRequest(identity=to_proto_identity(identity), emit_evidence=emit_evidence)
    ctx = context or {}
    req.context.CopyFrom(pb.Context(
        timestamp=ctx.get("timestamp", ""), ip_address=ctx.get("ip_address", ""),
        session_id=ctx.get("session_id", ""), user_agent=ctx.get("user_agent", ""),
    ))
    if resource is not None:
        req.protected_data = resource.to_bytes() if isinstance(resource, ProtectedData) else resource
    elif policy is not None:
        req.policy.CopyFrom(to_proto_policy(policy))
    resp = client.call("Check", req)
    return Decision.from_pb(resp.decision)


def explain(decision: Decision) -> str:
    """Human-readable reason for a decision (sugar over ``decision.reason``)."""
    return decision.reason
