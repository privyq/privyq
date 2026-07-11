import { describe, it, expect } from "vitest";
import { generateKey, getKey, listKeys, rotateKey, revokeKey } from "../src/index.js";
import { jsonResponse, mockGateway } from "./helpers.js";

const KEY = {
  key_id: "key_1",
  public_key: "pk_base64",
  algorithm: "kyber_768",
  type: "encryption",
  status: "active",
  created_at: "2026-07-11T10:00:00Z",
};

describe("keys", () => {
  it("generateKey posts algorithm/type and camelCases the response", async () => {
    const { calls } = mockGateway((call) => {
      expect(call.url).toBe("http://gw.test/api/v1/keys/generate");
      expect(call.method).toBe("POST");
      return jsonResponse(KEY);
    });
    const key = await generateKey({ type: "signing", owner: "dr_smith" });
    const sent = calls[0]!.body as Record<string, unknown>;
    expect(sent.type).toBe("signing");
    expect(sent.owner).toBe("dr_smith");
    expect(sent.algorithm).toBe("kyber_768");
    expect(key.keyId).toBe("key_1");
    expect(key.publicKey).toBe("pk_base64");
    expect(key.createdAt).toBe("2026-07-11T10:00:00Z");
  });

  it("getKey fetches by id", async () => {
    const { calls } = mockGateway(() => jsonResponse(KEY));
    const key = await getKey("key 1/special");
    expect(calls[0]!.url).toBe("http://gw.test/api/v1/keys/key%201%2Fspecial");
    expect(key.keyId).toBe("key_1");
  });

  it("listKeys maps every entry", async () => {
    mockGateway(() =>
      jsonResponse({ keys: [KEY, { ...KEY, key_id: "key_2", expires_at: "2026-08-01" }] }),
    );
    const keys = await listKeys();
    expect(keys.map((k) => k.keyId)).toEqual(["key_1", "key_2"]);
    expect(keys[1]!.expiresAt).toBe("2026-08-01");
  });

  it("rotateKey and revokeKey POST to the right path", async () => {
    const { calls } = mockGateway(() => jsonResponse({}));
    await rotateKey("key_1");
    await revokeKey("key_1", { reason: "compromised" });
    expect(calls[0]!.url).toBe("http://gw.test/api/v1/keys/rotate/key_1");
    expect(calls[1]!.url).toBe("http://gw.test/api/v1/keys/revoke/key_1");
    expect(calls[0]!.method).toBe("POST");
  });
});
