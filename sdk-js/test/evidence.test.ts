import { describe, it, expect } from "vitest";
import { evidence } from "../src/index.js";
import { bytesToText } from "../src/base64.js";
import { bytesResponse, jsonResponse, mockGateway, wireEvidence } from "./helpers.js";

const LOG = {
  entries: [wireEvidence({ position: 1 }), wireEvidence({ evidence_id: "ev_002", position: 2 })],
  total: 2,
  page: 1,
  page_size: 20,
  verified: true,
};

describe("evidence", () => {
  it("evidence.of returns the trail for a resource", async () => {
    const { calls } = mockGateway((call) => {
      expect(call.url).toContain("/api/v1/evidence/log");
      expect(call.url).toContain("resource_id=res_42");
      return jsonResponse(LOG);
    });
    const trail = await evidence.of("res_42");
    expect(trail).toHaveLength(2);
    expect(trail[0]!.evidenceId).toBe("ev_001");
    expect(calls[0]!.method).toBe("GET");
  });

  it("evidence.log returns a paginated, camelCased slice", async () => {
    mockGateway(() => jsonResponse(LOG));
    const page = await evidence.log({ actorId: "dr_smith", page: 1, pageSize: 20 });
    expect(page.total).toBe(2);
    expect(page.pageSize).toBe(20);
    expect(page.verified).toBe(true);
    expect(page.entries[1]!.evidenceId).toBe("ev_002");
  });

  it("evidence.verify reports chain integrity", async () => {
    mockGateway(() => jsonResponse(LOG));
    const result = await evidence.verify({ resourceId: "res_42" });
    expect(result.ok).toBe(true);
    expect(result.chainValid).toBe(true);
    expect(result.detail).toContain("2");
  });

  it("evidence.verify surfaces a broken chain", async () => {
    mockGateway(() => jsonResponse({ ...LOG, verified: false }));
    const result = await evidence.verify();
    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/failed/);
  });

  it("evidence.export returns bytes", async () => {
    mockGateway((call) => {
      expect(call.url).toContain("format=csv");
      return bytesResponse(new TextEncoder().encode("id,actor\nev_001,dr_smith\n"));
    });
    const bytes = await evidence.export("csv", { resourceId: "res_42" });
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytesToText(bytes)).toContain("ev_001");
  });

  it("complianceReport passes the framework and returns the object", async () => {
    mockGateway((call) => {
      expect(call.url).toContain("framework=HIPAA");
      return jsonResponse({ framework: "HIPAA", compliant: true });
    });
    const report = await evidence.complianceReport({ framework: "HIPAA" });
    expect(report.compliant).toBe(true);
  });
});
