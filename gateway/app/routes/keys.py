from fastapi import APIRouter, Depends
from ..auth.auth import authenticate
from ..schemas.models import KeyGenerateRequest, KeyListResponse, KeyResponse
from ..services import privyq_client

router = APIRouter()


@router.get("/keys", response_model=KeyListResponse, tags=["keys"])
async def list_keys(_identity: dict = Depends(authenticate)):
    """List all managed keys with their status."""
    return privyq_client.list_keys()


@router.post("/keys/generate", response_model=KeyResponse, tags=["keys"])
async def generate(req: KeyGenerateRequest, _identity: dict = Depends(authenticate)):
    """Generate a new key pair (BP App B.5)."""
    return privyq_client.generate_key(req.model_dump())


@router.get("/keys/{key_id}", response_model=KeyResponse, tags=["keys"])
async def get_key(key_id: str, _identity: dict = Depends(authenticate)):
    """Get public key info by id (BP App B; closes v1 gap B6)."""
    return privyq_client.get_key(key_id)


@router.post("/keys/rotate/{key_id}", tags=["keys"])
async def rotate(key_id: str, _identity: dict = Depends(authenticate)):
    """Rotate a key (BP App B.6)."""
    return privyq_client.rotate_key(key_id)


@router.post("/keys/revoke/{key_id}", tags=["keys"])
async def revoke(key_id: str, _identity: dict = Depends(authenticate)):
    """Revoke a key."""
    return privyq_client.revoke_key(key_id)
