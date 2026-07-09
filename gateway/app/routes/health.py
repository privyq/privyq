from fastapi import APIRouter
from ..schemas.models import HealthResponse
from ..services import privyq_client

router = APIRouter()


@router.get("/health", response_model=HealthResponse, tags=["ops"])
async def health():
    """Service health, including core reachability (BP App B.7)."""
    try:
        core = privyq_client.health()
        return {"status": "healthy", "services": {"gateway": "healthy", **core.get("services", {})}, "version": core.get("version", "")}
    except Exception:  # noqa: BLE001 - health must never raise
        return {"status": "degraded", "services": {"gateway": "healthy", "core": "unreachable"}, "version": ""}
