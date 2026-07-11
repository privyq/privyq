/**
 * Encoding helpers that work identically in Node (18+) and the browser.
 *
 * The gateway exchanges binary payloads (plaintext, ciphertext envelopes, data
 * to sign) as base64 strings. We use the standard global `btoa`/`atob` and the
 * WHATWG `TextEncoder`/`TextDecoder`, all of which are present in Node 18+ and
 * every modern browser — so the SDK needs no runtime dependency for this.
 */

/** UTF-8 encode a string, or pass through raw bytes. */
export function toBytes(data: string | Uint8Array): Uint8Array {
  return typeof data === "string" ? new TextEncoder().encode(data) : data;
}

/** Decode UTF-8 bytes to a string (invalid sequences become U+FFFD). */
export function bytesToText(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

/** Encode bytes as a base64 string. Chunked so large inputs don't blow the stack. */
export function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary);
}

/** Decode a base64 string back to bytes. */
export function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}
