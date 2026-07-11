"""Evidence-log retrieval (BP §11.2, ARCH §15.4)."""

from __future__ import annotations

from typing import List

from ._proto import privyq_pb2 as pb
from .client import Client, get_default_client
from .models import Receipt


def log(
    *,
    resource_id: str = "",
    actor_id: str = "",
    start_time: str = "",
    end_time: str = "",
    page: int = 1,
    page_size: int = 20,
    client: Client | None = None,
) -> List[Receipt]:
    """Return audit receipts matching the filter, in chain order."""
    client = client or get_default_client()
    req = pb.GetEvidenceLogRequest(
        resource_id=resource_id,
        actor_id=actor_id,
        start_time=start_time,
        end_time=end_time,
        page=page,
        page_size=page_size,
    )
    resp = client.call("GetEvidenceLog", req)
    return [Receipt.from_pb(e) for e in resp.entries]


def export(
    fmt: str = "json",
    *,
    resource_id: str = "",
    actor_id: str = "",
    start_time: str = "",
    end_time: str = "",
    client: Client | None = None,
) -> bytes:
    """Export the evidence trail as ``json`` | ``csv`` | ``pdf`` for compliance."""
    client = client or get_default_client()
    req = pb.ExportEvidenceRequest(
        resource_id=resource_id, actor_id=actor_id,
        start_time=start_time, end_time=end_time, format=fmt,
    )
    resp = client.call("ExportEvidence", req)
    return resp.content
