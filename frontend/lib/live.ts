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

/* ── v2: PBAC/ABAC decision surface (blueprint §5, §6, App B) ── */

/**
 * A free-form identity: the ABAC subject. `role`/`department`/`purpose`/
 * `organization` are the well-known keys the gateway lifts onto the proto
 * Identity; any other key (approval_limit, emergency, subscription, credits,
 * wallet, amount, shift, …) is carried in the generic attribute map and can be
 * conditioned on by a policy without new code (blueprint §6.1).
 */
export type AbacIdentity = Record<string, string | number | boolean | undefined>;

/**
 * A v2 policy document. The structured form (`conditions` / `deny_conditions` /
 * `obligations` / `custom_logic` / `policy_id`) is what the core's PDP evaluates
 * (blueprint App D). Kept as an open shape because the demo composes several
 * scenario policies (healthcare, banking break-glass, AI credits, wallet).
 */
export interface DecisionPolicy {
  policy_id?: string;
  version?: string;
  combination?: "all" | "any" | "custom";
  conditions?: { type: string; operator: string; value: string | number | string[]; negate?: boolean }[];
  deny_conditions?: { type: string; operator: string; value: string | number | string[]; negate?: boolean }[];
  custom_logic?: string;
  obligations?: string[];
  metadata?: Record<string, string>;
}

/** POST /api/v1/check request (blueprint App B, §17 — Policy-Decision-as-a-Service). */
export interface CheckBody {
  identity: AbacIdentity;
  policy?: DecisionPolicy;
  protected_data?: string; // base64 envelope — policy taken from it
  context?: Record<string, string>;
  emit_evidence?: boolean;
}

/**
 * The `Decision` (blueprint §6.2, App A). Every check/access returns one:
 * allowed + a human `reason`, the conditions that `matched` vs `failed`, and
 * any `obligations` the enforcement point must honour on a grant.
 */
export interface Decision {
  allowed: boolean;
  reason: string;
  matched: string[];
  failed: string[];
  obligations: string[];
  policy_id: string;
  evaluated_at: string;
  evaluated_conditions?: Record<string, unknown>[];
  evidence?: Record<string, unknown> | null;
}

/** POST /api/v1/explain response — the human `reason` sugar over a decision. */
export interface ExplainResult {
  allowed: boolean;
  reason: string;
}

/** POST /api/v1/seal request — a post-quantum signature over base64 data. */
export interface SealBody {
  data: string; // base64
  key_id?: string;
  algorithm?: string;
}

/** The `Sealed` signature (blueprint App A). */
export interface SealResult {
  data_hash: string;
  signature: string;
  algorithm: string;
  key_id: string;
  sealed_at: string;
}

/** GET /api/v1/keys/{id} — public key info (closes v1 gap B6). */
export interface KeyInfo {
  key_id: string;
  public_key: string;
  algorithm: string;
  type: string;
  status: string;
  created_at: string;
}

/* ── v2: compliance tooling (blueprint §13) ── */

/** One mapped control and whether the evidence demonstrates it. */
export interface ComplianceControl {
  id: string;
  name: string;
  satisfied: boolean;
  basis: string;
}

/**
 * GET /api/v1/compliance/report — the evidence chain mapped onto a framework's
 * controls (core-go/internal/compliance). Snake-case mirrors the Go struct.
 */
export interface ComplianceReport {
  framework: string;
  generated_at: string;
  total_events: number;
  granted: number;
  denied: number;
  by_purpose: Record<string, number>;
  chain_verified: boolean;
  controls: ComplianceControl[];
}

export type EvidenceExportFormat = "json" | "csv" | "pdf";
