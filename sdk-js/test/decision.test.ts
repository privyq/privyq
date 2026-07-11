import { describe, it, expect } from "vitest";
import { check, explain, protect, ProtectedData } from "../src/index.js";
import { jsonResponse, mockGateway, wireEvidence } from "./helpers.js";

const DENIED = {
  allowed: false,
  reason: "Role 'nurse' cannot access cardiology records.",
  matched: ["role"],
  failed: ["shift", "department"],
  obligations: ["notify_dpo"],
  policy_id: "pol_1",
  evaluated_at: "2026-07-11T10:00:00Z",
  evaluated_conditions: [{ type: "department", passed: false }],
  evidence: null,
};

describe("check / explain", () => {
  it("returns a self-explaining denied Decision (no data revealed)", async () => {
    const { calls } = mockGateway((call) => {
      expect(call.url).toBe("http://gw.test/api/v1/check");
      return jsonResponse(DENIED);
    });

    const decision = await check({ role: "nurse" }, "ENVELOPE", { purpose: "treatment" });

    const sent = calls[0]!.body as Record<string, unknown>;
    expect(sent.identity).toEqual({ role: "nurse", purpose: "treatment" });
    expect(sent.protected_data).toBe("ENVELOPE");

    expect(decision.allowed).toBe(false);
    expect(decision.reason).toContain("nurse");
    expect(decision.failed).toEqual(["shift", "department"]);
    expect(decision.matched).toEqual(["role"]);
    expect(decision.obligations).toEqual(["notify_dpo"]);
    expect(decision.policyId).toBe("pol_1");
    expect(explain(decision)).toBe(DENIED.reason);
  });

  it("sends an explicit policy object as `policy`, not `protected_data`", async () => {
    const { calls } = mockGateway(() =>
      jsonResponse({ ...DENIED, allowed: true, reason: "ok", failed: [] }),
    );
    const decision = await check({ role: "doctor" }, { role: "doctor", shift: "active" });
    const sent = calls[0]!.body as Record<string, unknown>;
    expect(sent.policy).toEqual({ role: "doctor", shift: "active" });
    expect(sent.protected_data).toBeUndefined();
    expect(decision.allowed).toBe(true);
  });

  it("passes a ProtectedData envelope through as protected_data", async () => {
    mockGateway((call) => {
      if (call.url.endsWith("/protect")) {
        return jsonResponse({ protected_data: "PD_ENV", metadata: {}, evidence: wireEvidence() });
      }
      expect((call.body as Record<string, unknown>).protected_data).toBe("PD_ENV");
      return jsonResponse({ ...DENIED, allowed: true, reason: "", failed: [] });
    });
    const pd = await protect("data", { role: "doctor" });
    expect(pd).toBeInstanceOf(ProtectedData);
    await check({ role: "doctor" }, pd, { emitEvidence: true });
  });
});
