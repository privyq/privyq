/**
 * PrivyQ SDK error hierarchy.
 *
 * Mirrors the Python SDK's intention-level exceptions (`sdk-python/privyq/
 * exceptions.py`) and the gateway's HTTP status mapping (`gateway/app/main.py`),
 * so application code catches meaningful errors instead of inspecting status
 * codes by hand:
 *
 *   | HTTP | gateway code    | SDK error                |
 *   |------|-----------------|--------------------------|
 *   | 401  | (auth)          | AuthenticationError      |
 *   | 403  | FORBIDDEN       | AccessDenied             |
 *   | 404  | NOT_FOUND       | KeyNotFoundError         |
 *   | 409  | CONFLICT        | KeyRevokedError          |
 *   | 422  | (validation)    | RequestValidationError   |
 *   | 429  | RATE_LIMITED    | RateLimitedError         |
 *   | 500  | INTERNAL_ERROR  | CryptoError              |
 *   | 503  | CORE_UNREACHABLE| CoreUnavailableError     |
 *   | —    | network / abort | CoreUnavailableError     |
 */

/** Base class for every error the SDK raises. */
export class PrivyQError extends Error {
  /** HTTP status, when the error originated from a gateway response. */
  readonly status?: number;
  /** Machine-readable gateway error code (e.g. "FORBIDDEN"), when present. */
  readonly code?: string;
  /** The raw parsed response body, for debugging. */
  readonly body?: unknown;

  constructor(message: string, opts: { status?: number; code?: string; body?: unknown } = {}) {
    super(message);
    this.name = new.target.name;
    this.status = opts.status;
    this.code = opts.code;
    this.body = opts.body;
    // Restore prototype chain for older transpile targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/** Base class for policy failures (parent of {@link AccessDenied}). */
export class PolicyViolationError extends PrivyQError {}

/**
 * Access was denied because the embedded policy was not satisfied.
 *
 * Carries the human-readable `reason` (the gateway's policy message), matching
 * the blueprint's contract that a denied `access` raises with `decision.reason`.
 */
export class AccessDenied extends PolicyViolationError {
  /** The policy reason for the denial — same text as `decision.reason`. */
  readonly reason: string;

  constructor(message: string, opts: { status?: number; code?: string; body?: unknown } = {}) {
    super(message, opts);
    this.reason = message;
  }
}

/** A specific policy condition failed. */
export class ConditionFailedError extends PolicyViolationError {}

/** The policy's validity window has passed. */
export class ExpiredError extends PolicyViolationError {}

/** Base class for key-management errors. */
export class KeyError extends PrivyQError {}

/** The referenced key does not exist. */
export class KeyNotFoundError extends KeyError {}

/** The referenced key has been revoked. */
export class KeyRevokedError extends KeyError {}

/** A key rotation operation failed. */
export class KeyRotationError extends KeyError {}

/** Base class for cryptographic failures reported by the core. */
export class CryptoError extends PrivyQError {}

/** Decryption or authentication of the ciphertext failed. */
export class DecryptionFailedError extends CryptoError {}

/** A signature failed to verify. */
export class SignatureVerificationError extends CryptoError {}

/** Verifying an evidence chain failed (tamper detected). */
export class AuditVerificationError extends PrivyQError {}

/** Base class for connectivity errors. */
export class ConnectionError extends PrivyQError {}

/** The gateway/core could not be reached (network error, DNS, or timeout). */
export class CoreUnavailableError extends ConnectionError {}

/** A request exceeded the configured timeout. */
export class TimeoutError extends CoreUnavailableError {}

/** Authentication failed (missing/invalid API key or bearer token). */
export class AuthenticationError extends PrivyQError {}

/** The gateway rejected the request body (HTTP 422). */
export class RequestValidationError extends PrivyQError {}

/** The client is being rate-limited by the gateway (HTTP 429). */
export class RateLimitedError extends PrivyQError {}

/** The SDK is misconfigured (e.g. no `fetch` available). */
export class ConfigurationError extends PrivyQError {}

/**
 * A verb has no REST route on the current gateway.
 *
 * Used for capabilities the blueprint defines but the gateway does not yet
 * expose over HTTP (see the SDK README "Gateway gaps" section).
 */
export class UnsupportedOperationError extends PrivyQError {}

/** Map an HTTP status + parsed body to the appropriate typed error. */
export function errorForStatus(status: number, message: string, body: unknown): PrivyQError {
  const code = extractCode(body);
  const opts = { status, code, body };
  switch (status) {
    case 401:
      return new AuthenticationError(message, opts);
    case 403:
      return new AccessDenied(message, opts);
    case 404:
      return new KeyNotFoundError(message, opts);
    case 409:
      return new KeyRevokedError(message, opts);
    case 422:
      return new RequestValidationError(message, opts);
    case 429:
      return new RateLimitedError(message, opts);
    case 503:
      return new CoreUnavailableError(message, opts);
    case 500:
      return new CryptoError(message, opts);
    default:
      return new PrivyQError(message, opts);
  }
}

function extractCode(body: unknown): string | undefined {
  if (typeof body !== "object" || body === null) return undefined;
  const err = (body as Record<string, unknown>).error;
  if (typeof err === "object" && err !== null) {
    const c = (err as Record<string, unknown>).code;
    if (typeof c === "string") return c;
  }
  return undefined;
}
