import { vi } from "vitest";
import { configure, resetConfig } from "../src/index.js";

export interface CapturedCall {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

/** Build a JSON `Response`. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Build a raw bytes `Response`. */
export function bytesResponse(bytes: Uint8Array, status = 200): Response {
  return new Response(bytes as unknown as BodyInit, {
    status,
    headers: { "Content-Type": "application/octet-stream" },
  });
}

/**
 * Install a mocked fetch that returns `next(call)` for each request, recording
 * every call. Returns the array of captured calls and the vitest mock.
 */
export function mockGateway(next: (call: CapturedCall) => Response | Promise<Response>) {
  const calls: CapturedCall[] = [];
  const fetchMock = vi.fn(async (input: unknown, init?: RequestInit) => {
    const url = String(input);
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers as Record<string, string> | undefined;
    if (rawHeaders) for (const [k, v] of Object.entries(rawHeaders)) headers[k.toLowerCase()] = v;
    const body = init?.body ? JSON.parse(init.body as string) : undefined;
    const call: CapturedCall = { url, method: init?.method ?? "GET", headers, body };
    calls.push(call);
    return next(call);
  });
  resetConfig();
  configure({ gatewayUrl: "http://gw.test", fetch: fetchMock as unknown as typeof fetch });
  return { calls, fetchMock };
}

/** Install a mocked fetch that returns a single fixed response. */
export function mockOnce(response: Response) {
  return mockGateway(() => response);
}

/** A representative wire (snake_case) evidence entry, as the gateway returns. */
export function wireEvidence(overrides: Record<string, unknown> = {}) {
  return {
    evidence_id: "ev_001",
    version: "2.0",
    timestamp: "2026-07-11T10:00:00Z",
    actor: { user_id: "dr_smith", role: "doctor" },
    resource_id: "res_42",
    resource_hash: "abc123",
    policy: { role: "doctor" },
    operation: "protect",
    result: "granted",
    policy_evaluation: { allowed: true },
    signature: "sig_deadbeef",
    public_key_id: "key_1",
    signing_algorithm: "dilithium_3",
    parent_hash: "prev_hash",
    position: 1,
    metadata: {},
    ...overrides,
  };
}
