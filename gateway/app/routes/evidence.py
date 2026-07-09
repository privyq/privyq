from fastapi import APIRouter, Depends, Query
from ..auth.auth import authenticate
from ..schemas.models import EvidenceLogResponse
from ..services import privyq_client

router = APIRouter()


@router.get("/evidence/log", response_model=EvidenceLogResponse, tags=["audit"])
async def evidence_log(
    resource_id: str = Query(default=""),
    actor_id: str = Query(default=""),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=200),
    _identity: dict = Depends(authenticate),
):
    """Retrieve audit evidence for a resource/actor (BP App B.4)."""
    return privyq_client.evidence_log(resource_id, actor_id, page, page_size)
