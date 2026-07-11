/**
 * protect() — encrypt data and embed its policy (blueprint §5).
 *
 * The returned {@link ProtectedData} carries the base64 ciphertext envelope; the
 * policy travels inside it and is enforced at `access`/`check` time. Pass the
 * `ProtectedData` (or its `.envelope` string) straight to `access`/`check`.
 */

import { bytesToBase64, toBytes } from "./base64.js";
import { getConfig } from "./config.js";
import { request } from "./http.js";
import {
  toEvidence,
  type Evidence,
  type Identity,
  type Policy,
  type WireProtectRequest,
  type WireProtectResponse,
} from "./types.js";

export interface ProtectOptions {
  /** Use a specific key instead of letting the core pick/generate one. */
  keyId?: string;
  /** Override the KEM algorithm (defaults to the configured default). */
  algorithm?: string;
  /** A caller-chosen resource id, echoed into evidence. */
  resourceId?: string;
  /** The actor performing the protect, recorded in evidence. */
  actor?: Identity;
}

/** Encrypted data plus its metadata and the evidence entry for the operation. */
export class ProtectedData {
  /** Base64 ciphertext envelope — pass this to `access`/`check`. */
  readonly protectedData: string;
  readonly metadata: Record<string, unknown>;
  readonly evidence: Evidence;

  constructor(protectedData: string, metadata: Record<string, unknown>, evidence: Evidence) {
    this.protectedData = protectedData;
    this.metadata = metadata;
    this.evidence = evidence;
  }

  /** Alias for {@link protectedData}: the envelope string to authorize against. */
  get envelope(): string {
    return this.protectedData;
  }

  get keyId(): string | undefined {
    return str(this.metadata.key_id) ?? (this.evidence.publicKeyId || undefined);
  }

  get algorithm(): string | undefined {
    return str(this.metadata.algorithm);
  }

  get policyHash(): string | undefined {
    return str(this.metadata.policy_hash);
  }

  get resourceId(): string {
    return str(this.metadata.resource_id) ?? this.evidence.resourceId;
  }

  static fromResponse(resp: WireProtectResponse): ProtectedData {
    return new ProtectedData(resp.protected_data, resp.metadata ?? {}, toEvidence(resp.evidence));
  }
}

function str(v: unknown): string | undefined {
  return typeof v === "string" && v ? v : undefined;
}

export async function protect(
  data: string | Uint8Array,
  policy: Policy = {},
  opts: ProtectOptions = {},
): Promise<ProtectedData> {
  const config = getConfig();
  const reqBody: WireProtectRequest = {
    data: bytesToBase64(toBytes(data)),
    policy,
    algorithm: opts.algorithm ?? config.defaultAlgorithm ?? null,
    key_id: opts.keyId ?? null,
    resource_id: opts.resourceId ?? "",
    actor: opts.actor ?? null,
  };
  const resp = await request<WireProtectResponse>("/api/v1/protect", {
    method: "POST",
    body: reqBody,
  });
  return ProtectedData.fromResponse(resp);
}
