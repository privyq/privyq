import { describe, it, expect, beforeEach } from "vitest";
import { configure, getConfig, resetConfig } from "../src/index.js";

describe("configure", () => {
  beforeEach(() => resetConfig());

  it("has sane defaults", () => {
    const c = getConfig();
    expect(c.gatewayUrl).toBe("http://localhost:8000");
    expect(c.defaultAlgorithm).toBe("kyber_768");
    expect(c.defaultSignature).toBe("dilithium_3");
    expect(c.timeoutMs).toBeGreaterThan(0);
  });

  it("merges options and strips a trailing slash from gatewayUrl", () => {
    configure({ gatewayUrl: "https://api.example.com/", apiKey: "pk_123" });
    expect(getConfig().gatewayUrl).toBe("https://api.example.com");
    expect(getConfig().apiKey).toBe("pk_123");
  });

  it("accepts coreAddress for parity without breaking", () => {
    configure({ coreAddress: "localhost:50051" });
    expect(getConfig().coreAddress).toBe("localhost:50051");
  });

  it("rejects unknown options", () => {
    // @ts-expect-error intentional bad key
    expect(() => configure({ nope: 1 })).toThrow(/unknown configuration option/);
  });
});
