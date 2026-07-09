from fastapi import APIRouter, Depends
from ..auth.auth import authenticate
from ..schemas.models import PolicyEvaluateRequest, PolicyEvaluationResponse
from ..services import privyq_client

router = APIRouter()


@router.post("/policy/evaluate", response_model=PolicyEvaluationResponse, tags=["policy"])
async def evaluate(req: PolicyEvaluateRequest, _identity: dict = Depends(authenticate)):
    """Evaluate a policy against an identity/context — no side effects.

    Powers the interactive policy playground; runs the core's real policy engine.
    """
    return privyq_client.evaluate_policy(req.policy, req.identity, req.context)
