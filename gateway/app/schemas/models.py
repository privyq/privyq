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
