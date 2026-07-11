/**
 * access() — authorize against the embedded policy, then reveal (blueprint §5).
 *
 * `access` = `check` + reveal. It makes the same decision `check` returns and
 * decrypts iff allowed. A denial raises {@link AccessDenied} (HTTP 403), carrying
 * the policy reason; the denied attempt is still recorded as evidence by the core.
 */

import { base64ToBytes, bytesToText } from "./base64.js";
import { request } from "./http.js";
import { ProtectedData } from "./protect.js";
import {
  toEvidence,
  type Context,
  type Evidence,
  type Identity,
  type WireAccessRequest,
  type WireAccessResponse,
} from "./types.js";

export interface AccessOptions {
  /** The purpose of access; merged into the identity for policy evaluation. */
  purpose?: string;
  /** Optional request context (timestamp, ip, session, user agent). */
  context?: Context;
}

/** A successful access: the revealed plaintext plus its evidence entry. */
export class AccessResult {
  readonly data: Uint8Array;
  readonly evidence: Evidence;

  constructor(data: Uint8Array, evidence: Evidence) {
    this.data = data;
    this.evidence = evidence;
  }

  /** The plaintext decoded as UTF-8 text. */
  text(): string {
    return bytesToText(this.data);
  }
}

/** Envelope string for either a {@link ProtectedData} or a raw base64 string. */
export function toEnvelope(protectedData: ProtectedData | string): string {
  return protectedData instanceof ProtectedData ? protectedData.envelope : protectedData;
}

export async function access(
  protectedData: ProtectedData | string,
  identity: Identity,
  opts: AccessOptions = {},
): Promise<AccessResult> {
  const ident: Identity = opts.purpose ? { ...identity, purpose: opts.purpose } : identity;
  const reqBody: WireAccessRequest = {
    protected_data: toEnvelope(protectedData),
    identity: ident,
    context: opts.context ?? null,
  };
  const resp = await request<WireAccessResponse>("/api/v1/access", {
    method: "POST",
    body: reqBody,
  });
  return new AccessResult(base64ToBytes(resp.data), toEvidence(resp.audit_evidence));
}
