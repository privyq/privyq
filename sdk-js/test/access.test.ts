import { describe, it, expect } from "vitest";
import { access, AccessResult, AccessDenied, ProtectedData } from "../src/index.js";
import { bytesToBase64, toBytes } from "../src/base64.js";
import { jsonResponse, mockGateway, wireEvidence } from "./helpers.js";

describe("access", () => {
  it("sends the envelope + identity and decodes the returned plaintext", async () => {
    const plaintext = "Patient: John Doe";
    const { calls } = mockGateway((call) => {
      expect(call.url).toBe("http://gw.test/api/v1/access");
      return jsonResponse({
        data: bytesToBase64(toBytes(plaintext)),
        audit_evidence: wireEvidence({ operation: "access", result: "granted" }),
      });
    });

    const protectedData = new ProtectedData("ENV==", {}, {
      raw: wireEvidence(),
    } as never);
    const result = await access(protectedData, { role: "doctor" }, { purpose: "treatment" });

    const sent = calls[0]!.body as Record<string, unknown>;
    expect(sent.protected_data).toBe("ENV==");
    expect(sent.identity).toEqual({ role: "doctor", purpose: "treatment" });

    expect(result).toBeInstanceOf(AccessResult);
    expect(result.text()).toBe(plaintext);
    expect(result.evidence.operation).toBe("access");
  });

  it("accepts a raw envelope string", async () => {
    const { calls } = mockGateway(() =>
      jsonResponse({ data: bytesToBase64(toBytes("hi")), audit_evidence: wireEvidence() }),
    );
    await access("RAWENV", { role: "nurse" });
    expect((calls[0]!.body as Record<string, unknown>).protected_data).toBe("RAWENV");
  });

  it("maps a 403 denial to AccessDenied carrying the policy reason", async () => {
    mockGateway(() =>
      jsonResponse(
        { error: { code: "FORBIDDEN", message: "Role 'nurse' cannot access this record." } },
        403,
      ),
    );
    await expect(access("ENV", { role: "nurse" })).rejects.toMatchObject({
      name: "AccessDenied",
      status: 403,
      reason: "Role 'nurse' cannot access this record.",
    });
    await expect(access("ENV", { role: "nurse" })).rejects.toBeInstanceOf(AccessDenied);
  });
});
