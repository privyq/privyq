/**
 * REST request/response types for the FastAPI gateway.
 *
 * These are the richer, UI-facing domain types. The gateway's OpenAPI models
 * `policy` / `identity` / `evidence` as free-form objects, so the generated
 * types (lib/api-types.gen.ts, produced by `npm run gen:api` from
 * docs/api/openapi.json) are intentionally *looser* than these — a blind swap
 * would regress type safety. F2 wires the generated schema in as the contract
 * of record via the compile-time conformance binding at the bottom of this
 * file: if the gateway renames or retypes a bound envelope field, regenerating
 * the schema fails the build. See CONTRIBUTING.md (TS conventions).
 */

/* ── Policy schema (BP §14.1 / App D) ── */
export type PolicyOperator =
  | "equals"
  | "in"
  | "one_of"
  | "before"
  | "after"
  | "not_equals";

export type PolicyConditionType =
  | "role"
  | "department"
  | "purpose"
  | "classification"
  | "expiry"
  | "jurisdiction"
  | "organization";

export interface PolicyCondition {
  type: PolicyConditionType;
  operator: PolicyOperator;
  value: string | string[];
}

export type PolicyCombination = "all" | "any";

export interface Policy {
  version?: string;
  conditions: PolicyCondition[];
  combination: PolicyCombination;
  metadata?: {
    created_at?: string;
    created_by?: string;
    description?: string;
  };
}

/* ── Identity / context ── */
export interface Identity {
  user_id: string;
  role: string;
  department: string;
  purpose: string;
  organization?: string;
}

export interface AccessContext {
  timestamp?: string;
  ip_address?: string;
  session_id?: string;
}

/* ── Evidence ── */
export interface EvidenceActor {
  user_id: string;
  role: string;
}

export interface EvidenceResource {
  resource_id: string;
  resource_hash: string;
}

export interface Evidence {
  evidence_id: string;
  timestamp: string;
  signature: string;
  actor?: EvidenceActor;
  resource?: EvidenceResource;
  operation?: "protect" | "access";
  result?: "granted" | "denied";
  chain_hash?: string;
  parent_hash?: string;
  position?: number;
  signing_algorithm?: string;
  data?: string;
}

/* ── B.1 Protect ── */
export interface ProtectRequest {
  data: string;
  policy: Policy;
  algorithm?: string;
  key_id?: string;
  resource_id?: string;
}

export interface ProtectResponse {
  protected_data: string;
  metadata: {
    algorithm: string;
    policy_hash: string;
    timestamp: string;
    key_id: string;
  };
  evidence: Evidence;
}

/* ── B.2 Access ── */
export interface AccessRequest {
  protected_data: string;
  identity: Identity;
  context?: AccessContext;
}

export interface EvaluatedCondition {
  type: string;
  expected: string | string[];
  actual: string;
  result: boolean;
}

export interface PolicyEvaluation {
  decision: "granted" | "denied";
  reason: string;
  evaluated_conditions: EvaluatedCondition[];
}

export interface AccessResponse {
  data: string;
  audit_evidence: Evidence;
}

export interface AccessDenied {
  error: string;
  details: string;
  policy_evaluation: PolicyEvaluation;
}

/* ── B.3 Verify ── */
export interface VerifyRequest {
  evidence: Evidence;
}

export interface VerifyResponse {
  verified: boolean;
  signature_valid: boolean;
  chain_valid: boolean;
  policy_compliant: boolean;
  details?: {
    signature_algorithm: string;
    public_key_id: string;
    chain_position: number;
    verification_time: string;
  };
}

/* ── B.4 Evidence log ── */
export interface EvidenceLogEntry {
  evidence_id: string;
  timestamp: string;
  actor: EvidenceActor;
  resource: EvidenceResource;
  operation: "protect" | "access";
  result: "granted" | "denied";
  signature: string;
}

export interface EvidenceLogQuery {
  page?: number;
  page_size?: number;
  resource_id?: string;
  actor_id?: string;
  start_time?: string;
  end_time?: string;
}

export interface EvidenceLogResponse {
  entries: EvidenceLogEntry[];
  total: number;
  page: number;
  page_size: number;
  verified: boolean;
}

/* ── B.5 / B.6 Keys ── */
export type KeyAlgorithm = "kyber_512" | "kyber_768" | "kyber_1024";
export type KeyType = "encryption" | "signing";
export type KeyStatus = "active" | "rotated" | "revoked" | "expired";

export interface KeyGenerateRequest {
  algorithm?: KeyAlgorithm;
  type?: KeyType;
  metadata?: { description?: string };
}

export interface KeyResponse {
  key_id: string;
  public_key: string;
  algorithm: KeyAlgorithm;
  type: KeyType;
  status?: KeyStatus;
  created_at: string;
  expires_at?: string;
}

export interface KeyRotateResponse {
  old_key_id: string;
  new_key_id: string;
  rotated_at: string;
  grace_period: string;
}

export interface KeyRevokeResponse {
  key_id: string;
  status: KeyStatus;
  revoked_at: string;
}

/* ── B.7 Health ── */
export interface HealthResponse {
  status: string;
  services: Record<string, string>;
  version: string;
  timestamp?: string;
}

/* ────────────────────────────────────────────────────────────────────────
 * F2 — OpenAPI conformance binding
 *
 * `lib/api-types.gen.ts` is generated from the gateway's OpenAPI spec
 * (docs/api/openapi.json) via `npm run gen:api`. Because the gateway models
 * nested objects (policy/identity/evidence) as free-form, the generated types
 * are looser than the domain types above. Rather than regress the UI's typing
 * with a blind swap, we bind the *scalar envelope fields* of the hand-written
 * types to the generated schema below. These are compile-time assertions with
 * no runtime cost: if the gateway contract renames or retypes a bound field,
 * `npm run gen:api` regenerates the schema and these fail `npm run build`.
 * ──────────────────────────────────────────────────────────────────────── */
import type { components } from "./api-types.gen";

type _Schemas = components["schemas"];
/** Compile-time assertion that `Actual` is assignable to `Expected`. */
type Conforms<Expected, Actual extends Expected> = Actual;

// Requests the client sends must provide the schema's required scalar fields…
type _ReqProtect = Conforms<Pick<_Schemas["ProtectRequest"], "data">, Pick<ProtectRequest, "data">>;
type _ReqAccess = Conforms<Pick<_Schemas["AccessRequest"], "protected_data">, Pick<AccessRequest, "protected_data">>;
type _ReqKeyGen = Conforms<Pick<_Schemas["KeyGenerateRequest"], "type">, Required<Pick<KeyGenerateRequest, "type">>>;

// …and responses the client reads must carry the schema's scalar fields.
type _RespProtect = Conforms<Pick<_Schemas["ProtectResponse"], "protected_data">, Pick<ProtectResponse, "protected_data">>;
type _RespAccess = Conforms<Pick<_Schemas["AccessResponse"], "data">, Pick<AccessResponse, "data">>;
type _RespVerify = Conforms<
  Pick<_Schemas["VerifyResponse"], "verified" | "signature_valid" | "chain_valid" | "policy_compliant">,
  Pick<VerifyResponse, "verified" | "signature_valid" | "chain_valid" | "policy_compliant">
>;
type _RespHealth = Conforms<
  Pick<_Schemas["HealthResponse"], "status" | "services" | "version">,
  Pick<HealthResponse, "status" | "services" | "version">
>;
type _RespKey = Conforms<
  Pick<_Schemas["KeyResponse"], "key_id" | "public_key" | "algorithm" | "type" | "created_at">,
  Pick<KeyResponse, "key_id" | "public_key" | "algorithm" | "type" | "created_at">
>;
type _RespLog = Conforms<
  Pick<_Schemas["EvidenceLogResponse"], "total" | "page" | "page_size" | "verified">,
  Pick<EvidenceLogResponse, "total" | "page" | "page_size" | "verified">
>;

/** Aggregate so the conformance aliases are referenced (and enforced). */
export type ApiConformance = [
  _ReqProtect, _ReqAccess, _ReqKeyGen,
  _RespProtect, _RespAccess, _RespVerify, _RespHealth, _RespKey, _RespLog,
];
