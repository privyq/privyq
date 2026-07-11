"""Pydantic request/response models for the REST API (BP Appendix B)."""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field


class ProtectRequest(BaseModel):
    data: str = Field(..., description="base64-encoded plaintext")
    policy: dict[str, Any]
    algorithm: str | None = None
    key_id: str | None = None
    resource_id: str = ""
    actor: dict[str, Any] | None = None


class EvidenceModel(BaseModel):
    evidence_id: str = ""
    version: str = ""
    timestamp: str = ""
    actor: dict[str, Any] = Field(default_factory=dict)
    resource_id: str = ""
    resource_hash: str = ""
    policy: dict[str, Any] = Field(default_factory=dict)
    operation: str = ""
    result: str = ""
    policy_evaluation: dict[str, Any] = Field(default_factory=dict)
    signature: str = ""
    public_key_id: str = ""
    signing_algorithm: str = ""
    parent_hash: str = ""
    position: int = 0
    metadata: dict[str, str] = Field(default_factory=dict)


class ProtectResponse(BaseModel):
    protected_data: str = Field(..., description="base64-encoded envelope")
    metadata: dict[str, Any]
    evidence: EvidenceModel


class AccessRequest(BaseModel):
    protected_data: str
    identity: dict[str, Any]
    context: dict[str, Any] | None = None


class AccessResponse(BaseModel):
    data: str = Field(..., description="base64-encoded plaintext")
    audit_evidence: EvidenceModel


class VerifyRequest(BaseModel):
    evidence: EvidenceModel
    reevaluate: bool = True


class VerifyResponse(BaseModel):
    verified: bool
    signature_valid: bool
    chain_valid: bool
    policy_compliant: bool
    detail: str = ""


class EvidenceLogResponse(BaseModel):
    entries: list[EvidenceModel]
    total: int
    page: int
    page_size: int
    verified: bool


class KeyGenerateRequest(BaseModel):
    algorithm: str | None = None
    type: str = "encryption"
    organization: str = ""
    owner: str = ""
    metadata: dict[str, str] = Field(default_factory=dict)


class KeyResponse(BaseModel):
    key_id: str
    public_key: str
    algorithm: str
    type: str
    status: str
    created_at: str


class KeyInfoModel(BaseModel):
    key_id: str = ""
    algorithm: str = ""
    type: str = ""
    public_key: str = ""
    status: str = ""
    created_at: str = ""
    expires_at: str = ""
    rotated_at: str = ""
    revoked_at: str = ""
    organization: str = ""
    owner: str = ""


class KeyListResponse(BaseModel):
    keys: list[KeyInfoModel]


class CheckRequest(BaseModel):
    identity: dict[str, Any]
    policy: dict[str, Any] | None = None
    protected_data: str | None = Field(None, description="base64 envelope (policy taken from it)")
    context: dict[str, Any] | None = None
    emit_evidence: bool = False


class DecisionResponse(BaseModel):
    allowed: bool = False
    reason: str = ""
    matched: list[str] = Field(default_factory=list)
    failed: list[str] = Field(default_factory=list)
    obligations: list[str] = Field(default_factory=list)
    policy_id: str = ""
    evaluated_at: str = ""
    evaluated_conditions: list[dict[str, Any]] = Field(default_factory=list)
    evidence: dict[str, Any] | None = None


class ExplainResponse(BaseModel):
    allowed: bool = False
    reason: str = ""


class SealRequest(BaseModel):
    data: str = Field(..., description="base64-encoded data to sign")
    key_id: str = ""
    algorithm: str = ""


class SealResponse(BaseModel):
    data_hash: str = ""
    signature: str = ""
    algorithm: str = ""
    key_id: str = ""
    sealed_at: str = ""


class PolicyEvaluateRequest(BaseModel):
    policy: dict[str, Any]
    identity: dict[str, Any]
    context: dict[str, Any] | None = None


class PolicyEvaluationResponse(BaseModel):
    decision: str = "denied"
    reason: str = ""
    evaluated_conditions: list[dict[str, Any]] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: str
    services: dict[str, str]
    version: str


class ErrorBody(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)
    timestamp: str


class ErrorResponse(BaseModel):
    error: ErrorBody
