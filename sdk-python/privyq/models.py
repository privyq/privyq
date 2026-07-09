"""User-facing result objects returned by the SDK."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ._proto import privyq_pb2 as pb


@dataclass
class Receipt:
    """A signed access receipt (audit evidence) for one operation."""

    id: str
    timestamp: str
    actor: str
    operation: str
    result: str
    signature: str
    parent_hash: str
    position: int
    _raw: pb.Evidence = field(repr=False, default=None)

    @classmethod
    def from_pb(cls, ev: pb.Evidence) -> "Receipt":
        return cls(
            id=ev.evidence_id,
            timestamp=ev.timestamp,
            actor=ev.actor.user_id,
            operation=ev.operation,
            result=ev.result,
            signature=ev.signature,
            parent_hash=ev.parent_hash,
            position=ev.position,
            _raw=ev,
        )


@dataclass
class ProtectedData:
    """Encrypted data plus its metadata. ``raw`` is the serialized envelope that
    must be passed back to :func:`privyq.access`."""

    raw: bytes
    key_id: str
    algorithm: str
    policy_hash: str
    receipt: Receipt | None = None

    def to_bytes(self) -> bytes:
        return self.raw


@dataclass
class AccessResult:
    """The outcome of a successful access: the plaintext and its receipt."""

    data: bytes
    receipt: Receipt

    @property
    def text(self) -> str:
        return self.data.decode("utf-8", errors="replace")


@dataclass
class VerificationResult:
    """The outcome of verifying a receipt/evidence entry."""

    ok: bool
    signature_valid: bool
    chain_valid: bool
    policy_compliant: bool
    detail: str = ""

    def __bool__(self) -> bool:
        return self.ok
