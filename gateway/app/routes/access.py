from fastapi import APIRouter, Depends
from ..auth.auth import authenticate
from ..schemas.models import AccessRequest, AccessResponse
from ..services import privyq_client

router = APIRouter()


@router.post("/access", response_model=AccessResponse, tags=["encryption"])
async def access(req: AccessRequest, identity: dict = Depends(authenticate)):
    """Decrypt data if the embedded policy is satisfied (BP App B.2).

    Returns 403 with the policy evaluation when access is denied.
    """
    ident = {**identity, **req.identity} if identity else req.identity
    return privyq_client.access(req.protected_data, ident, req.context)
