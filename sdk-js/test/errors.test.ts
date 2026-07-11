import { describe, it, expect } from "vitest";
import {
  getKey,
  health,
  AuthenticationError,
  KeyNotFoundError,
  KeyRevokedError,
  CoreUnavailableError,
  CryptoError,
  RateLimitedError,
  RequestValidationError,
  TimeoutError,
  ConfigurationError,
  configure,
  resetConfig,
} from "../src/index.js";
import { jsonResponse, mockGateway } from "./helpers.js";

describe("error mapping", () => {
  const cases: [number, unknown, unknown][] = [
    [401, { detail: "authentication required" }, AuthenticationError],
    [404, { error: { code: "NOT_FOUND", message: "no such key" } }, KeyNotFoundError],
    [409, { error: { code: "CONFLICT", message: "key revoked" } }, KeyRevokedError],
    [422, { detail: [{ loc: ["body", "data"], msg: "field required", type: "missing" }] }, RequestValidationError],
    [429, { error: { code: "RATE_LIMITED", message: "Too many requests" } }, RateLimitedError],
    [500, { error: { code: "INTERNAL_ERROR", message: "boom" } }, CryptoError],
    [503, { error: { code: "CORE_UNREACHABLE", message: "core down" } }, CoreUnavailableError],
  ];

  for (const [status, body, ctor] of cases) {
    it(`maps HTTP ${status} to ${(ctor as { name: string }).name}`, async () => {
      mockGateway(() => jsonResponse(body, status));
      await expect(getKey("k")).rejects.toBeInstanceOf(ctor as never);
    });
  }

  it("extracts the gateway envelope message and status", async () => {
    mockGateway(() => jsonResponse({ error: { code: "NOT_FOUND", message: "no such key: k9" } }, 404));
    await expect(getKey("k9")).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      message: "no such key: k9",
    });
  });

  it("extracts a FastAPI 422 validation message", async () => {
    mockGateway(() =>
      jsonResponse({ detail: [{ loc: ["body", "policy"], msg: "field required", type: "missing" }] }, 422),
    );
    await expect(getKey("k")).rejects.toMatchObject({ message: "field required" });
  });

  it("maps network failures to CoreUnavailableError", async () => {
    resetConfig();
    configure({
      gatewayUrl: "http://gw.test",
      fetch: (async () => {
        throw new TypeError("fetch failed");
      }) as unknown as typeof fetch,
    });
    await expect(health()).rejects.toBeInstanceOf(CoreUnavailableError);
  });

  it("maps an aborted request to TimeoutError", async () => {
    resetConfig();
    configure({
      gatewayUrl: "http://gw.test",
      timeoutMs: 5,
      fetch: (async (_url: unknown, init?: RequestInit) => {
        return await new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            const err = new Error("aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      }) as unknown as typeof fetch,
    });
    await expect(health()).rejects.toBeInstanceOf(TimeoutError);
  });

  it("raises ConfigurationError when no fetch is available", async () => {
    resetConfig();
    configure({ gatewayUrl: "http://gw.test", fetch: undefined });
    const original = globalThis.fetch;
    // @ts-expect-error simulate an environment without global fetch
    delete globalThis.fetch;
    try {
      await expect(health()).rejects.toBeInstanceOf(ConfigurationError);
    } finally {
      globalThis.fetch = original;
    }
  });
});
