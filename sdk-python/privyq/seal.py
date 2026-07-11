"""seal() — post-quantum digital signature over arbitrary data (blueprint §5)."""

from __future__ import annotations

from dataclasses import dataclass

from ._proto import privyq_pb2 as pb
from .client import Client, get_default_client


@dataclass
class Sealed:
    """A self-describing post-quantum signature. Pass it to :func:`verify`."""

    data_hash: str
    signature: str
    algorithm: str
    key_id: str
    sealed_at: str = ""

    @classmethod
    def from_pb(cls, s: pb.Sealed) -> "Sealed":
        return cls(data_hash=s.data_hash, signature=s.signature, algorithm=s.algorithm,
                   key_id=s.key_id, sealed_at=s.sealed_at)

    def to_pb(self) -> pb.Sealed:
        return pb.Sealed(data_hash=self.data_hash, signature=self.signature,
                         algorithm=self.algorithm, key_id=self.key_id, sealed_at=self.sealed_at)


def seal(data: bytes, *, key_id: str = "", algorithm: str = "", client: Client | None = None) -> Sealed:
    """Sign ``data`` with a post-quantum key, returning a self-describing seal."""
    client = client or get_default_client()
    resp = client.call("Seal", pb.SealRequest(data=data, key_id=key_id, algorithm=algorithm))
    return Sealed.from_pb(resp.sealed)
