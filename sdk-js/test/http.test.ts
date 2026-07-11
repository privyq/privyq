import { describe, it, expect } from "vitest";
import { configure, health, listKeys } from "../src/index.js";
import { jsonResponse, mockGateway } from "./helpers.js";

describe("transport headers & health", () => {
  it("sends X-API-Key and Bearer token when configured", async () => {
    const { calls } = mockGateway(() => jsonResponse({ keys: [] }));
    configure({ apiKey: "pk_live_123", token: "jwt_abc" });
    await listKeys();
    expect(calls[0]!.headers["x-api-key"]).toBe("pk_live_123");
    expect(calls[0]!.headers["authorization"]).toBe("Bearer jwt_abc");
  });

  it("omits auth headers when not configured", async () => {
    const { calls } = mockGateway(() => jsonResponse({ keys: [] }));
    await listKeys();
    expect(calls[0]!.headers["x-api-key"]).toBeUndefined();
    expect(calls[0]!.headers["authorization"]).toBeUndefined();
  });

  it("health() returns the gateway snapshot", async () => {
    mockGateway(() =>
      jsonResponse({ status: "ok", services: { core: "up" }, version: "1.0.0" }),
    );
    const h = await health();
    expect(h.status).toBe("ok");
    expect(h.services.core).toBe("up");
    expect(h.version).toBe("1.0.0");
  });
});
