/**
 * seal() — post-quantum digital signature over arbitrary data (blueprint §5).
 *
 * Returns a self-describing {@link Sealed} you pass to `verify`. All cryptography
 * happens in the core; the SDK only carries bytes.
 */

import { bytesToBase64, toBytes } from "./base64.js";
import { request } from "./http.js";
import { type WireSealRequest, type WireSealResponse } from "./types.js";

export interface SealOptions {
  /** Sign with a specific signing key. */
  keyId?: string;
  /** Override the signature algorithm (defaults to the core's default). */
  algorithm?: string;
}

/** A self-describing post-quantum signature. Pass it to `verify`. */
export class Sealed {
  readonly dataHash: string;
  readonly signature: string;
  readonly algorithm: string;
  readonly keyId: string;
  readonly sealedAt: string;

  constructor(fields: {
    dataHash: string;
    signature: string;
    algorithm: string;
    keyId: string;
    sealedAt: string;
  }) {
    this.dataHash = fields.dataHash;
    this.signature = fields.signature;
    this.algorithm = fields.algorithm;
    this.keyId = fields.keyId;
    this.sealedAt = fields.sealedAt;
  }

  static fromResponse(r: WireSealResponse): Sealed {
    return new Sealed({
      dataHash: r.data_hash,
      signature: r.signature,
      algorithm: r.algorithm,
      keyId: r.key_id,
      sealedAt: r.sealed_at,
    });
  }
}

export async function seal(data: string | Uint8Array, opts: SealOptions = {}): Promise<Sealed> {
  const reqBody: WireSealRequest = {
    data: bytesToBase64(toBytes(data)),
    key_id: opts.keyId ?? "",
    algorithm: opts.algorithm ?? "",
  };
  const resp = await request<WireSealResponse>("/api/v1/seal", { method: "POST", body: reqBody });
  return Sealed.fromResponse(resp);
}
