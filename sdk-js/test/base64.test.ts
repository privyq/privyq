import { describe, it, expect } from "vitest";
import { base64ToBytes, bytesToBase64, bytesToText, toBytes } from "../src/base64.js";

describe("base64 helpers", () => {
  it("round-trips text through bytes and base64", () => {
    const text = "Patient: José — beta-blocker ✓";
    const b64 = bytesToBase64(toBytes(text));
    expect(bytesToText(base64ToBytes(b64))).toBe(text);
  });

  it("round-trips arbitrary binary", () => {
    const bytes = new Uint8Array([0, 1, 2, 255, 254, 128, 42]);
    const b64 = bytesToBase64(bytes);
    expect(Array.from(base64ToBytes(b64))).toEqual(Array.from(bytes));
  });

  it("passes raw bytes through toBytes unchanged", () => {
    const bytes = new Uint8Array([9, 8, 7]);
    expect(toBytes(bytes)).toBe(bytes);
  });

  it("handles large inputs without stack overflow", () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 256);
    expect(base64ToBytes(bytesToBase64(big)).length).toBe(big.length);
  });
});
