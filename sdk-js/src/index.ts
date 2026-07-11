/**
 * @privyq/sdk — the TypeScript/JavaScript SDK for PrivyQ.
 *
 * Post-quantum, policy-governed encryption with verifiable evidence, behind an
 * intention-based verb vocabulary. Talks to the PrivyQ gateway over REST and
 * runs in both Node (18+) and the browser with no runtime dependencies.
 *
 * @example
 * import { configure, protect, access, check } from "@privyq/sdk";
 *
 * configure({ gatewayUrl: "http://localhost:8000", apiKey: "pk_…" });
 *
 * const record = await protect("Patient: John Doe…", {
 *   role: "doctor", department: "cardiology", purpose: "treatment", expiry: "24h",
 * });
 * const decision = await check({ role: "nurse" }, record);   // no data revealed
 * const opened   = await access(record, { role: "doctor", department: "cardiology" },
 *                               { purpose: "treatment" });
 */

// ── configuration ──
export { configure, getConfig, resetConfig } from "./config.js";
export type { PrivyQConfig, ConfigureOptions, FetchLike } from "./config.js";

// ── verbs: decisions ──
export { protect, ProtectedData } from "./protect.js";
export type { ProtectOptions } from "./protect.js";
export { access, AccessResult } from "./access.js";
export type { AccessOptions } from "./access.js";
export { check, explain } from "./decision.js";
export type { CheckOptions, CheckTarget } from "./decision.js";

// ── verbs: signatures + verification ──
export { seal, Sealed } from "./seal.js";
export type { SealOptions } from "./seal.js";
export { verify } from "./verify.js";
export type { VerifyOptions, VerifyTarget } from "./verify.js";

// ── evidence ──
export {
  evidence,
  of as evidenceOf,
  log as evidenceLogEntries,
  exportEvidence,
  complianceReport,
} from "./evidence.js";
export type { EvidenceFilters, ExportFilters, ComplianceFilters } from "./evidence.js";

// ── keys ──
export { generateKey, getKey, listKeys, rotateKey, revokeKey } from "./keys.js";
export type { GenerateKeyOptions, RotateKeyOptions, RevokeKeyOptions } from "./keys.js";

// ── identity ──
export { verifyWallet } from "./wallet.js";
export type { VerifyWalletParams } from "./wallet.js";

// ── misc ──
export { health } from "./health.js";

// ── types ──
export type {
  Policy,
  Identity,
  Context,
  Decision,
  Evidence,
  EvidenceLog,
  VerificationResult,
  KeyInfo,
  Health,
  WalletVerification,
} from "./types.js";

// ── errors ──
export {
  PrivyQError,
  PolicyViolationError,
  AccessDenied,
  ConditionFailedError,
  ExpiredError,
  KeyError,
  KeyNotFoundError,
  KeyRevokedError,
  KeyRotationError,
  CryptoError,
  DecryptionFailedError,
  SignatureVerificationError,
  AuditVerificationError,
  ConnectionError,
  CoreUnavailableError,
  TimeoutError,
  AuthenticationError,
  RequestValidationError,
  RateLimitedError,
  ConfigurationError,
  UnsupportedOperationError,
} from "./errors.js";
