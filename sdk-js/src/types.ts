/**
 * Types for the PrivyQ SDK.
 *
 * This file has two halves:
 *
 *  1. **Wire types** (`Wire*`) — snake_case interfaces that mirror the gateway's
 *     OpenAPI contract at `docs/api/openapi.json` exactly. They are the source
 *     of truth for what goes over the network. They are hand-written to keep the
 *     SDK dependency- and codegen-free, but they intentionally track the OpenAPI
 *     component schemas 1:1. When the contract changes, regenerate a reference
 *     with `npm run gen:api` (writes `src/generated/openapi.d.ts`) and reconcile.
 *
 *  2. **Public types** — the camelCase, idiomatic shapes the SDK returns to
 *     callers. Verb files convert wire → public.
 */

/* ────────────────────────── Wire types (mirror OpenAPI) ────────────────────────── */

/** OpenAPI: EvidenceModel. A single tamper-evident audit entry. */
export interface WireEvidence {
  evidence_id: string;
  version: string;
  timestamp: string;
  actor: Record<string, unknown>;
  resource_id: string;
  resource_hash: string;
  policy: Record<string, unknown>;
  operation: string;
  result: string;
  policy_evaluation: Record<string, unknown>;
  signature: string;
  public_key_id: string;
  signing_algorithm: string;
  parent_hash: string;
  position: number;
  metadata: Record<string, string>;
}

/** OpenAPI: ProtectRequest. */
export interface WireProtectRequest {
  data: string;
  policy: Record<string, unknown>;
  algorithm?: string | null;
  key_id?: string | null;
  resource_id?: string;
  actor?: Record<string, unknown> | null;
}

/** OpenAPI: ProtectResponse. */
export interface WireProtectResponse {
  protected_data: string;
  metadata: Record<string, unknown>;
  evidence: WireEvidence;
}

/** OpenAPI: AccessRequest. */
export interface WireAccessRequest {
  protected_data: string;
  identity: Record<string, unknown>;
  context?: Record<string, unknown> | null;
}

/** OpenAPI: AccessResponse. */
export interface WireAccessResponse {
  data: string;
  audit_evidence: WireEvidence;
}

/** OpenAPI: CheckRequest. */
export interface WireCheckRequest {
  identity: Record<string, unknown>;
  policy?: Record<string, unknown> | null;
  protected_data?: string | null;
  context?: Record<string, unknown> | null;
  emit_evidence?: boolean;
}

/** OpenAPI: DecisionResponse. */
export interface WireDecisionResponse {
  allowed: boolean;
  reason: string;
  matched: string[];
  failed: string[];
  obligations: string[];
  policy_id: string;
  evaluated_at: string;
  evaluated_conditions: Record<string, unknown>[];
  evidence?: Record<string, unknown> | null;
}

/** OpenAPI: ExplainResponse. */
export interface WireExplainResponse {
  allowed: boolean;
  reason: string;
}

/** OpenAPI: SealRequest. */
export interface WireSealRequest {
  data: string;
  key_id?: string;
  algorithm?: string;
}

/** OpenAPI: SealResponse. */
export interface WireSealResponse {
  data_hash: string;
  signature: string;
  algorithm: string;
  key_id: string;
  sealed_at: string;
}

/** OpenAPI: VerifyRequest. */
export interface WireVerifyRequest {
  evidence: WireEvidence;
  reevaluate?: boolean;
}

/** OpenAPI: VerifyResponse. */
export interface WireVerifyResponse {
  verified: boolean;
  signature_valid: boolean;
  chain_valid: boolean;
  policy_compliant: boolean;
  detail: string;
}

/** OpenAPI: VerifySealRequest (POST /api/v1/verify/seal). */
export interface WireVerifySealRequest {
  data: string;
  sealed: WireSealResponse;
}

/** OpenAPI: VerifySealResponse. */
export interface WireVerifySealResponse {
  valid: boolean;
  detail: string;
}

/** OpenAPI: WalletVerifyRequest (POST /api/v1/identity/wallet). */
export interface WireWalletVerifyRequest {
  scheme: string;
  public_key: string;
  challenge: string;
  signature: string;
}

/** OpenAPI: WalletVerifyResponse. */
export interface WireWalletVerifyResponse {
  valid: boolean;
  address: string;
  detail: string;
}

/** OpenAPI: EvidenceLogResponse. */
export interface WireEvidenceLogResponse {
  entries: WireEvidence[];
  total: number;
  page: number;
  page_size: number;
  verified: boolean;
}

/** OpenAPI: KeyResponse. */
export interface WireKeyResponse {
  key_id: string;
  public_key: string;
  algorithm: string;
  type: string;
  status: string;
  created_at: string;
}

/** OpenAPI: KeyInfoModel. */
export interface WireKeyInfo {
  key_id: string;
  algorithm: string;
  type: string;
  public_key: string;
  status: string;
  created_at: string;
  expires_at: string;
  rotated_at: string;
  revoked_at: string;
  organization: string;
  owner: string;
}

/** OpenAPI: KeyListResponse. */
export interface WireKeyListResponse {
  keys: WireKeyInfo[];
}

/** OpenAPI: KeyGenerateRequest. */
export interface WireKeyGenerateRequest {
  algorithm?: string | null;
  type?: string;
  organization?: string;
  owner?: string;
  metadata?: Record<string, string>;
}

/** OpenAPI: HealthResponse. */
export interface WireHealthResponse {
  status: string;
  services: Record<string, string>;
  version: string;
}

/* ────────────────────────────── Public types ────────────────────────────── */

/**
 * A privacy policy. Accepts the same two forms as the Python SDK:
 *  - **shorthand** — a flat map where each key is a condition, e.g.
 *    `{ role: "doctor", department: ["cardiology"], expiry: "24h" }`
 *  - **structured** — `{ conditions: [...], combination: "all", obligations: [...] }`
 * The core normalizes and enforces it; the SDK passes it through unchanged.
 */
export type Policy = Record<string, unknown>;

/** An identity / set of attributes evaluated against a policy. */
export type Identity = Record<string, unknown>;

/** Optional request context (timestamp, ip, session, user agent, …). */
export type Context = Record<string, unknown>;

/** A tamper-evident audit entry (camelCase view of {@link WireEvidence}). */
export interface Evidence {
  evidenceId: string;
  version: string;
  timestamp: string;
  actor: Record<string, unknown>;
  resourceId: string;
  resourceHash: string;
  policy: Record<string, unknown>;
  operation: string;
  result: string;
  policyEvaluation: Record<string, unknown>;
  signature: string;
  publicKeyId: string;
  signingAlgorithm: string;
  parentHash: string;
  position: number;
  metadata: Record<string, string>;
  /** The original wire entry, preserved so it can be re-sent to `verify()`. */
  raw: WireEvidence;
}

/** A self-explaining authorization decision (from `check`). */
export interface Decision {
  allowed: boolean;
  reason: string;
  matched: string[];
  failed: string[];
  obligations: string[];
  policyId: string;
  evaluatedAt: string;
  evaluatedConditions: Record<string, unknown>[];
  /** Present only when `check` was called with `emitEvidence: true`. */
  evidence?: Record<string, unknown> | null;
}

/** The outcome of verifying evidence or a signature. */
export interface VerificationResult {
  ok: boolean;
  signatureValid: boolean;
  chainValid: boolean;
  policyCompliant: boolean;
  detail: string;
}

/** A paginated slice of the evidence log. */
export interface EvidenceLog {
  entries: Evidence[];
  total: number;
  page: number;
  pageSize: number;
  /** Whether the returned chain segment verified intact. */
  verified: boolean;
}

/** Public metadata about a managed key. */
export interface KeyInfo {
  keyId: string;
  algorithm: string;
  type: string;
  publicKey: string;
  status: string;
  createdAt: string;
  expiresAt?: string;
  rotatedAt?: string;
  revokedAt?: string;
  organization?: string;
  owner?: string;
}

/** Gateway health snapshot. */
export interface Health {
  status: string;
  services: Record<string, string>;
  version: string;
}

/**
 * The outcome of verifying a wallet/DID identity proof. When `valid`, `address`
 * is the recovered wallet address and can be used as a policy attribute.
 */
export interface WalletVerification {
  valid: boolean;
  address: string;
  detail: string;
}

/** Map a wire evidence entry to the public camelCase shape. */
export function toEvidence(w: WireEvidence): Evidence {
  return {
    evidenceId: w.evidence_id,
    version: w.version,
    timestamp: w.timestamp,
    actor: w.actor ?? {},
    resourceId: w.resource_id,
    resourceHash: w.resource_hash,
    policy: w.policy ?? {},
    operation: w.operation,
    result: w.result,
    policyEvaluation: w.policy_evaluation ?? {},
    signature: w.signature,
    publicKeyId: w.public_key_id,
    signingAlgorithm: w.signing_algorithm,
    parentHash: w.parent_hash,
    position: w.position,
    metadata: w.metadata ?? {},
    raw: w,
  };
}

/** Map a wire key (either KeyResponse or KeyInfoModel) to {@link KeyInfo}. */
export function toKeyInfo(w: WireKeyResponse | WireKeyInfo): KeyInfo {
  const info = w as Partial<WireKeyInfo> & WireKeyResponse;
  return {
    keyId: info.key_id,
    algorithm: info.algorithm,
    type: info.type,
    publicKey: info.public_key,
    status: info.status,
    createdAt: info.created_at,
    expiresAt: info.expires_at,
    rotatedAt: info.rotated_at,
    revokedAt: info.revoked_at,
    organization: info.organization,
    owner: info.owner,
  };
}
