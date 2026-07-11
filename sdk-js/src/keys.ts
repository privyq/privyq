/**
 * Key management (blueprint §11, §5 verb card).
 *
 *   generateKey(opts)   → POST /api/v1/keys/generate
 *   getKey(keyId)       → GET  /api/v1/keys/{id}
 *   listKeys()          → GET  /api/v1/keys
 *   rotateKey(keyId)    → POST /api/v1/keys/rotate/{id}
 *   revokeKey(keyId)    → POST /api/v1/keys/revoke/{id}
 *
 * GATEWAY GAP: the gateway's rotate/revoke routes take no request body, so the
 * Python SDK's `grace_period` / `reason` arguments cannot be forwarded over REST
 * yet. They are accepted here for forward-compatibility but not sent.
 */

import { getConfig } from "./config.js";
import { request } from "./http.js";
import {
  toKeyInfo,
  type KeyInfo,
  type WireKeyGenerateRequest,
  type WireKeyInfo,
  type WireKeyListResponse,
  type WireKeyResponse,
} from "./types.js";

export interface GenerateKeyOptions {
  algorithm?: string;
  /** Key purpose: "encryption" (default) or "signing". */
  type?: string;
  organization?: string;
  owner?: string;
  metadata?: Record<string, string>;
}

export interface RotateKeyOptions {
  /** Overlap window during which the old key still decrypts (gateway gap: unused). */
  gracePeriod?: string;
}

export interface RevokeKeyOptions {
  /** Reason recorded with the revocation (gateway gap: unused). */
  reason?: string;
}

export async function generateKey(opts: GenerateKeyOptions = {}): Promise<KeyInfo> {
  const config = getConfig();
  const reqBody: WireKeyGenerateRequest = {
    algorithm: opts.algorithm ?? config.defaultAlgorithm ?? null,
    type: opts.type ?? "encryption",
    organization: opts.organization ?? "",
    owner: opts.owner ?? "",
    metadata: opts.metadata ?? {},
  };
  const resp = await request<WireKeyResponse>("/api/v1/keys/generate", {
    method: "POST",
    body: reqBody,
  });
  return toKeyInfo(resp);
}

export async function getKey(keyId: string): Promise<KeyInfo> {
  const resp = await request<WireKeyResponse>(`/api/v1/keys/${encodeURIComponent(keyId)}`);
  return toKeyInfo(resp);
}

export async function listKeys(): Promise<KeyInfo[]> {
  const resp = await request<WireKeyListResponse>("/api/v1/keys");
  return (resp.keys ?? []).map((k: WireKeyInfo) => toKeyInfo(k));
}

export async function rotateKey(
  keyId: string,
  _opts: RotateKeyOptions = {},
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/v1/keys/rotate/${encodeURIComponent(keyId)}`, {
    method: "POST",
  });
}

export async function revokeKey(
  keyId: string,
  _opts: RevokeKeyOptions = {},
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>(`/api/v1/keys/revoke/${encodeURIComponent(keyId)}`, {
    method: "POST",
  });
}
