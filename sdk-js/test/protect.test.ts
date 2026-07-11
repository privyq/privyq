import { describe, it, expect } from "vitest";
import { protect, ProtectedData } from "../src/index.js";
import { base64ToBytes, bytesToText } from "../src/base64.js";
import { jsonResponse, mockGateway, wireEvidence } from "./helpers.js";

describe("protect", () => {
  it("base64-encodes the plaintext, forwards policy, and returns a ProtectedData", async () => {
    const { calls } = mockGateway((call) => {
      expect(call.url).toBe("http://gw.test/api/v1/protect");
      expect(call.method).toBe("POST");
      return jsonResponse({
        protected_data: "ZW52ZWxvcGU=", // "envelope"
        metadata: { key_id: "key_1", algorithm: "kyber_768", policy_hash: "ph" },
        evidence: wireEvidence(),
      });
    });

    const result = await protect("top secret", {
      role: "doctor",
      department: "cardiology",
    });

    // Request shape
    const sent = calls[0]!.body as Record<string, unknown>;
    expect(bytesToText(base64ToBytes(sent.data as string))).toBe("top secret");
    expect(sent.policy).toEqual({ role: "doctor", department: "cardiology" });
    expect(sent.algorithm).toBe("kyber_768");

    // Response shape
    expect(result).toBeInstanceOf(ProtectedData);
    expect(result.envelope).toBe("ZW52ZWxvcGU=");
    expect(result.keyId).toBe("key_1");
    expect(result.algorithm).toBe("kyber_768");
    expect(result.policyHash).toBe("ph");
    expect(result.evidence.evidenceId).toBe("ev_001");
    expect(result.evidence.resourceId).toBe("res_42");
  });

  it("honors an explicit algorithm and actor", async () => {
    const { calls } = mockGateway(() =>
      jsonResponse({ protected_data: "x", metadata: {}, evidence: wireEvidence() }),
    );
    await protect(new Uint8Array([1, 2, 3]), { role: "doctor" }, {
      algorithm: "kyber_1024",
      actor: { user_id: "dr_smith" },
      resourceId: "r1",
    });
    const sent = calls[0]!.body as Record<string, unknown>;
    expect(sent.algorithm).toBe("kyber_1024");
    expect(sent.actor).toEqual({ user_id: "dr_smith" });
    expect(sent.resource_id).toBe("r1");
  });
});
