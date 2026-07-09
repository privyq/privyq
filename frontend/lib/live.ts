/**
 * Live gateway request/response shapes — the exact JSON the FastAPI gateway
 * sends and receives (see gateway/app/schemas/models.py). These deliberately
 * mirror the server's wire format (flat `resource_id`, `actor` as an object,
 * base64 `data`), which is what the interactive pages consume.
 *
 * `Policy` / `Identity` are reused from ./types for the editor and personas.
 */
import type { Identity, Policy } from "./types";

/** A managed key as returned by GET /api/v1/keys. */
export interface ManagedKey {
  key_id: string;
  algorithm: string;
  type: string;
  public_key: string;
  status: string;
  created_at: string;
  expires_at?: string;
  rotated_at?: string;
  revoked_at?: string;
  organization?: string;
  owner?: string;
}

export interface KeyListResponse {
  keys: ManagedKey[];
}

/** Actor sub-object inside an evidence entry. */
export interface AuditActor {
  user_id?: string;
  role?: string;
  department?: string;
  purpose?: string;
  organization?: string;
}

/** One evidence entry as returned by the gateway (flat fields). */
export interface AuditEntry {
  evidence_id: string;
  version?: string;
  timestamp: string;
  actor: AuditActor;
  resource_id: string;
  resource_hash: string;
  policy?: Record<string, unknown>;
  operation: string; // protect | access
  result: string; // granted | denied
  policy_evaluation?: Record<string, unknown>;
  signature: string;
  public_key_id?: string;
  signing_algorithm?: string;
  parent_hash?: string;
  position?: number;
}

export interface EvidenceLog {
  entries: AuditEntry[];
  total: number;
  page: number;
  page_size: number;
  verified: boolean;
}

export interface ProtectBody {
  data: string; // base64
  policy: Policy;
  algorithm?: string;
  key_id?: string;
  resource_id?: string;
  actor?: Identity;
}

export interface ProtectResult {
  protected_data: string; // base64 envelope
  metadata: { key_id?: string; algorithm?: string; policy_hash?: string };
  evidence: AuditEntry;
}

export interface AccessBody {
  protected_data: string;
  identity: Identity;
  context?: { timestamp?: string; ip_address?: string; session_id?: string };
}

export interface AccessResult {
  data: string; // base64 plaintext
  audit_evidence: AuditEntry;
}

export interface VerifyResult {
  verified: boolean;
  signature_valid: boolean;
  chain_valid: boolean;
  policy_compliant: boolean;
  detail?: string;
}

export interface EvaluateBody {
  policy: Policy;
  identity: Identity;
  context?: { timestamp?: string };
}

export interface EvaluationResult {
  decision: "granted" | "denied";
  reason: string;
  evaluated_conditions: {
    type: string;
    expected: string;
    actual: string;
    result: boolean;
  }[];
}
