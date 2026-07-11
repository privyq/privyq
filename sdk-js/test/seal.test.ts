import { describe, it, expect } from "vitest";
import { seal, Sealed } from "../src/index.js";
import { base64ToBytes, bytesToText } from "../src/base64.js";
import { jsonResponse, mockGateway } from "./helpers.js";

describe("seal", () => {
  it("signs data and returns a self-describing Sealed", async () => {
    const { calls } = mockGateway((call) => {
      expect(call.url).toBe("http://gw.test/api/v1/seal");
      return jsonResponse({
        data_hash: "h_abc",
        signature: "sig_xyz",
        algorithm: "dilithium_3",
        key_id: "key_9",
        sealed_at: "2026-07-11T10:00:00Z",
      });
    });

    const sealed = await seal("discharge summary", { keyId: "key_9" });

    const sent = calls[0]!.body as Record<string, unknown>;
    expect(bytesToText(base64ToBytes(sent.data as string))).toBe("discharge summary");
    expect(sent.key_id).toBe("key_9");

    expect(sealed).toBeInstanceOf(Sealed);
    expect(sealed.dataHash).toBe("h_abc");
    expect(sealed.signature).toBe("sig_xyz");
    expect(sealed.algorithm).toBe("dilithium_3");
    expect(sealed.keyId).toBe("key_9");
    expect(sealed.sealedAt).toBe("2026-07-11T10:00:00Z");
  });
});
