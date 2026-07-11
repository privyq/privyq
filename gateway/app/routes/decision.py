"""v2 decision & signature routes: the Policy-Decision-as-a-Service surface."""
from fastapi import APIRouter, Depends, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field

from ..auth.auth import authenticate
from ..schemas.models import (
    CheckRequest,
    DecisionResponse,
    ExplainResponse,
    SealRequest,
    SealResponse,
)
from ..services import privyq_client

router = APIRouter()


@router.post("/check", response_model=DecisionResponse, tags=["decision"])
async def check(req: CheckRequest, _identity: dict = Depends(authenticate)):
    """The PDP decision — can this identity access this? No data revealed.

    Any service can call this to enforce the same policies consistently.
    """
    return privyq_client.check(req.identity, req.policy, req.protected_data, req.context, req.emit_evidence)


@router.post("/explain", response_model=ExplainResponse, tags=["decision"])
async def explain(req: CheckRequest, _identity: dict = Depends(authenticate)):
    """Human-readable reason for a decision (great for 403 bodies, debugging, UX)."""
    return privyq_client.explain(req.identity, req.policy, req.protected_data, req.context)


@router.post("/seal", response_model=SealResponse, tags=["signatures"])
async def seal(req: SealRequest, _identity: dict = Depends(authenticate)):
    """Post-quantum signature over data (the v2 seal() verb)."""
    return privyq_client.seal(req.data, req.key_id, req.algorithm)


class VerifySealRequest(BaseModel):
    data: str = Field(..., description="base64 original data")
    sealed: dict


class WalletVerifyRequest(BaseModel):
    scheme: str = "ed25519"
    public_key: str = Field(..., description="base64")
    challenge: str = Field(..., description="base64")
    signature: str = Field(..., description="base64")


@router.post("/verify/seal", tags=["signatures"])
async def verify_seal(req: VerifySealRequest, _identity: dict = Depends(authenticate)):
    """Verify a Sealed post-quantum signature against the original data."""
    return privyq_client.verify_seal(req.data, req.sealed)


@router.post("/identity/wallet", tags=["identity"])
async def verify_wallet(req: WalletVerifyRequest, _identity: dict = Depends(authenticate)):
    """Verify a signed wallet/DID challenge; the address becomes a policy attribute."""
    return privyq_client.verify_wallet(req.scheme, req.public_key, req.challenge, req.signature)


@router.get("/evidence/export", tags=["evidence"])
async def export_evidence(
    resource_id: str = "", actor_id: str = "", start_time: str = "", end_time: str = "",
    format: str = "json", _identity: dict = Depends(authenticate),
):
    """Export the evidence trail as json | csv | pdf for compliance."""
    content, content_type, filename = privyq_client.export_evidence(
        resource_id, actor_id, start_time, end_time, format)
    return Response(
        content=content, media_type=content_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/compliance/report", tags=["compliance"])
async def compliance_report(
    framework: str = "GDPR", resource_id: str = "", actor_id: str = "",
    start_time: str = "", end_time: str = "", _identity: dict = Depends(authenticate),
):
    """Map the evidence trail onto GDPR/HIPAA/SOC2 controls."""
    return JSONResponse(privyq_client.compliance_report(resource_id, actor_id, start_time, end_time, framework))
