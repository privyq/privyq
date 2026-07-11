/**
 * verifyWallet() — wallet / DID identity verification (blueprint §10).
 *
 * Verifies a signature over a challenge with a wallet's public key. On success
 * the gateway returns the recovered wallet `address`, which callers use as a
 * policy attribute (e.g. gating access on a specific on-chain identity).
 *
 * All cryptography runs in the core; the SDK base64-encodes the binary inputs
 * and maps the response onto {@link WalletVerification}.
 */

import { bytesToBase64, toBytes } from "./base64.js";
import { request } from "./http.js";
import {
  type WalletVerification,
  type WireWalletVerifyRequest,
  type WireWalletVerifyResponse,
} from "./types.js";

export interface VerifyWalletParams {
  /** Signature scheme, e.g. "ed25519" (default) or "secp256k1". */
  scheme?: string;
  /** The wallet public key (bytes, or a string that will be UTF-8 encoded). */
  publicKey: string | Uint8Array;
  /** The challenge that was signed. */
  challenge: string | Uint8Array;
  /** The signature over the challenge. */
  signature: string | Uint8Array;
}

export async function verifyWallet(params: VerifyWalletParams): Promise<WalletVerification> {
  const reqBody: WireWalletVerifyRequest = {
    scheme: params.scheme ?? "ed25519",
    public_key: bytesToBase64(toBytes(params.publicKey)),
    challenge: bytesToBase64(toBytes(params.challenge)),
    signature: bytesToBase64(toBytes(params.signature)),
  };
  const resp = await request<WireWalletVerifyResponse>("/api/v1/identity/wallet", {
    method: "POST",
    body: reqBody,
  });
  return { valid: resp.valid, address: resp.address, detail: resp.detail ?? "" };
}
