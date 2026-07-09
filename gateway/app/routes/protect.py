from fastapi import APIRouter, Depends
from ..auth.auth import authenticate
from ..schemas.models import ProtectRequest, ProtectResponse
from ..services import privyq_client

router = APIRouter()


@router.post("/protect", response_model=ProtectResponse, tags=["encryption"])
async def protect(req: ProtectRequest, _identity: dict = Depends(authenticate)):
    """Encrypt data with an embedded policy (BP App B.1)."""
    return privyq_client.protect(req.data, req.policy, req.algorithm, req.key_id, req.resource_id, req.actor)
