import { describe, it, expect } from "vitest";
import { verifyWallet } from "../src/index.js";
import { base64ToBytes, bytesToText, toBytes } from "../src/base64.js";
import { jsonResponse, mockGateway } from "./helpers.js";

describe("verifyWallet", () => {
  it("base64-encodes inputs, defaults scheme to ed25519, and returns the address", async () => {
    const { calls } = mockGateway((call) => {
      expect(call.url).toBe("http://gw.test/api/v1/identity/wallet");
      expect(call.method).toBe("POST");
      return jsonResponse({ valid: true, address: "0xABCDEF", detail: "verified" });
    });

    const result = await verifyWallet({
      publicKey: "pubkey-material",
      challenge: "nonce-123",
      signature: "sig-bytes",
    });

    const sent = calls[0]!.body as Record<string, string>;
    expect(sent.scheme).toBe("ed25519");
    expect(bytesToText(base64ToBytes(sent.public_key!))).toBe("pubkey-material");
    expect(bytesToText(base64ToBytes(sent.challenge!))).toBe("nonce-123");
    expect(bytesToText(base64ToBytes(sent.signature!))).toBe("sig-bytes");

    expect(result.valid).toBe(true);
    expect(result.address).toBe("0xABCDEF");
    expect(result.detail).toBe("verified");
  });

  it("honors an explicit scheme and accepts raw byte inputs", async () => {
    const { calls } = mockGateway(() =>
      jsonResponse({ valid: false, address: "", detail: "bad signature" }),
    );
    const result = await verifyWallet({
      scheme: "secp256k1",
      publicKey: toBytes("pk"),
      challenge: new Uint8Array([1, 2, 3]),
      signature: new Uint8Array([9, 9, 9]),
    });
    expect((calls[0]!.body as Record<string, string>).scheme).toBe("secp256k1");
    expect(result.valid).toBe(false);
    expect(result.address).toBe("");
  });
});
