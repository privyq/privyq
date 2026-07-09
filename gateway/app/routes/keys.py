from fastapi import APIRouter, Depends
from ..auth.auth import authenticate
from ..schemas.models import KeyGenerateRequest, KeyResponse
from ..services import privyq_client

router = APIRouter()


@router.post("/keys/generate", response_model=KeyResponse, tags=["keys"])
async def generate(req: KeyGenerateRequest, _identity: dict = Depends(authenticate)):
    """Generate a new key pair (BP App B.5)."""
    return privyq_client.generate_key(req.model_dump())


@router.post("/keys/rotate/{key_id}", tags=["keys"])
async def rotate(key_id: str, _identity: dict = Depends(authenticate)):
    """Rotate a key (BP App B.6)."""
    return privyq_client.rotate_key(key_id)


@router.post("/keys/revoke/{key_id}", tags=["keys"])
async def revoke(key_id: str, _identity: dict = Depends(authenticate)):
    """Revoke a key."""
    return privyq_client.revoke_key(key_id)
