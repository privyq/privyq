import { describe, it, expect } from "vitest";
import { seal, verify, UnsupportedOperationError } from "../src/index.js";
import { bytesToBase64, toBytes } from "../src/base64.js";
import { toEvidence } from "../src/types.js";
import { jsonResponse, mockGateway, wireEvidence } from "./helpers.js";

const VERIFIED = {
  verified: true,
  signature_valid: true,
  chain_valid: true,
  policy_compliant: true,
  detail: "ok",
};

describe("verify (dispatch)", () => {
  it("verifies an evidence entry via POST /verify and re-sends the wire shape", async () => {
    const { calls } = mockGateway((call) => {
      expect(call.url).toBe("http://gw.test/api/v1/verify");
      return jsonResponse(VERIFIED);
    });

    const evidence = toEvidence(wireEvidence());
    const result = await verify(evidence);

    const sent = calls[0]!.body as Record<string, unknown>;
    // The original snake_case evidence must be re-sent, plus reevaluate default.
    expect((sent.evidence as Record<string, unknown>).evidence_id).toBe("ev_001");
    expect(sent.reevaluate).toBe(true);

    expect(result.ok).toBe(true);
    expect(result.signatureValid).toBe(true);
    expect(result.chainValid).toBe(true);
    expect(result.policyCompliant).toBe(true);
  });

  it("also accepts a raw wire evidence object", async () => {
    mockGateway(() => jsonResponse(VERIFIED));
    const result = await verify(wireEvidence() as never);
    expect(result.ok).toBe(true);
  });

  it("seal + verify round-trip: verifies a Sealed signature against the original data", async () => {
    const { calls } = mockGateway((call) => {
      if (call.url.endsWith("/api/v1/seal")) {
        return jsonResponse({
          data_hash: "h_abc",
          signature: "sig_xyz",
          algorithm: "dilithium_3",
          key_id: "key_9",
          sealed_at: "2026-07-11T10:00:00Z",
        });
      }
      // /api/v1/verify/seal — valid iff the re-sent data matches the payload.
      expect(call.url).toBe("http://gw.test/api/v1/verify/seal");
      const body = call.body as { data: string; sealed: Record<string, unknown> };
      const okData = bytesToBase64(toBytes("payload"));
      const valid = body.data === okData;
      return jsonResponse({ valid, detail: valid ? "signature valid" : "data mismatch" });
    });

    const sealed = await seal("payload");

    const good = await verify(sealed, { data: "payload" });
    // Assert the request carried the sealed fields and base64 data.
    const sealReq = calls[1]!.body as { data: string; sealed: Record<string, unknown> };
    expect(sealReq.sealed.signature).toBe("sig_xyz");
    expect(sealReq.sealed.data_hash).toBe("h_abc");
    expect(good.ok).toBe(true);
    expect(good.signatureValid).toBe(true);
    expect(good.chainValid).toBe(true);
    expect(good.policyCompliant).toBe(true);

    const tampered = await verify(sealed, { data: "TAMPERED" });
    expect(tampered.ok).toBe(false);
    expect(tampered.detail).toMatch(/mismatch/);
  });

  it("verify(sealed) still requires the original data", async () => {
    mockGateway(() =>
      jsonResponse({
        data_hash: "h",
        signature: "s",
        algorithm: "dilithium_3",
        key_id: "k",
        sealed_at: "t",
      }),
    );
    const sealed = await seal("payload");
    await expect(verify(sealed)).rejects.toBeInstanceOf(UnsupportedOperationError);
  });

  it("rejects unrecognized shapes", async () => {
    mockGateway(() => jsonResponse(VERIFIED));
    await expect(verify({} as never)).rejects.toBeInstanceOf(UnsupportedOperationError);
  });
});
