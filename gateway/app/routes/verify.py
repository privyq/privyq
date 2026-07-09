from fastapi import APIRouter, Depends
from ..auth.auth import authenticate
from ..schemas.models import VerifyRequest, VerifyResponse
from ..services import privyq_client

router = APIRouter()


@router.post("/verify", response_model=VerifyResponse, tags=["audit"])
async def verify(req: VerifyRequest, _identity: dict = Depends(authenticate)):
    """Verify an audit evidence entry (BP App B.3)."""
    return privyq_client.verify(req.evidence.model_dump(), req.reevaluate)
