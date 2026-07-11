/**
 * verify() — verify audit evidence OR a post-quantum seal (blueprint §5).
 *
 * `verify` dispatches on its argument's shape:
 *
 *   - `verify(evidence)`         → verifies an evidence entry's signature + chain
 *                                  position via the gateway's `POST /verify`.
 *   - `verify(sealed, { data })` → verifies a `Sealed` signature against the
 *                                  original data via `POST /verify/seal`.
 *
 * All cryptography runs in the core; the SDK only carries bytes and maps the
 * response onto {@link VerificationResult}.
 */

import { bytesToBase64, toBytes } from "./base64.js";
import { request } from "./http.js";
import { Sealed } from "./seal.js";
import { UnsupportedOperationError } from "./errors.js";
import {
  type Evidence,
  type VerificationResult,
  type WireEvidence,
  type WireVerifyRequest,
  type WireVerifyResponse,
  type WireVerifySealRequest,
  type WireVerifySealResponse,
} from "./types.js";

/** Anything carrying an evidence entry, or the entry itself. */
export type VerifyTarget =
  | Sealed
  | Evidence
  | WireEvidence
  | { evidence: Evidence }
  | { audit_evidence: WireEvidence };

export interface VerifyOptions {
  /** For seals: the original data the signature covers (required by the verb). */
  data?: string | Uint8Array;
  /** Re-run policy evaluation while verifying evidence (default true). */
  reevaluate?: boolean;
}

function resultFromResponse(r: WireVerifyResponse): VerificationResult {
  return {
    ok: r.verified,
    signatureValid: r.signature_valid,
    chainValid: r.chain_valid,
    policyCompliant: r.policy_compliant,
    detail: r.detail ?? "",
  };
}

/** Extract the wire evidence entry from the various accepted shapes. */
function toWireEvidence(target: VerifyTarget): WireEvidence | undefined {
  const obj = target as Record<string, unknown>;
  if (obj && typeof obj === "object") {
    // Public Evidence carries `.raw`; AccessResult/ProtectedData carry `.evidence`.
    if ("raw" in obj && obj.raw && typeof obj.raw === "object") {
      return obj.raw as WireEvidence;
    }
    const nested = (obj.evidence ?? obj.audit_evidence) as Evidence | WireEvidence | undefined;
    if (nested && typeof nested === "object") {
      if ("raw" in nested && nested.raw) return nested.raw as WireEvidence;
      if ("evidence_id" in nested) return nested as WireEvidence;
    }
    if ("evidence_id" in obj) return target as WireEvidence;
  }
  return undefined;
}

export async function verify(
  target: VerifyTarget,
  opts: VerifyOptions = {},
): Promise<VerificationResult> {
  if (target instanceof Sealed) {
    if (opts.data === undefined) {
      throw new UnsupportedOperationError(
        "verify(sealed) requires the original data: call verify(sealed, { data }).",
      );
    }
    const sealReq: WireVerifySealRequest = {
      data: bytesToBase64(toBytes(opts.data)),
      sealed: {
        data_hash: target.dataHash,
        signature: target.signature,
        algorithm: target.algorithm,
        key_id: target.keyId,
        sealed_at: target.sealedAt,
      },
    };
    const sealResp = await request<WireVerifySealResponse>("/api/v1/verify/seal", {
      method: "POST",
      body: sealReq,
    });
    return {
      ok: sealResp.valid,
      signatureValid: sealResp.valid,
      chainValid: true,
      policyCompliant: true,
      detail: sealResp.detail ?? "",
    };
  }

  const wire = toWireEvidence(target);
  if (!wire) {
    throw new UnsupportedOperationError(
      "verify() expects an evidence entry (from evidence.of/log, or an AccessResult) " +
        "or a Sealed signature; received an unrecognized shape.",
    );
  }

  const reqBody: WireVerifyRequest = { evidence: wire, reevaluate: opts.reevaluate ?? true };
  const resp = await request<WireVerifyResponse>("/api/v1/verify", {
    method: "POST",
    body: reqBody,
  });
  return resultFromResponse(resp);
}
