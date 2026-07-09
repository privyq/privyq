/**
 * Typed client for the PrivyQ FastAPI gateway (docs/blueprint.md Appendix B).
 *
 * Base URL comes from NEXT_PUBLIC_API_URL (default http://localhost:8000).
 * Every call has a short timeout. Network failures become `CoreOfflineError`
 * and non-2xx responses become `ApiError` (whose `.status` the UI inspects to
 * distinguish a 403 policy denial from a real error).
 */
import type {
  AccessBody,
  AccessResult,
  AuditEntry,
  EvaluateBody,
  EvidenceLog,
  EvaluationResult,
  KeyListResponse,
  ManagedKey,
  ProtectBody,
  ProtectResult,
  VerifyResult,
} from "@/lib/live";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const DEFAULT_TIMEOUT_MS = 6000;

/** Thrown when the gateway cannot be reached (network error / timeout). */
export class CoreOfflineError extends Error {
  constructor(message = "PrivyQ core is offline") {
    super(message);
    this.name = "CoreOfflineError";
  }
}

/** Thrown when the gateway responds with a non-2xx status. */
export class ApiError extends Error {
  status: number;
  body: unknown;
  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  token?: string;
  query?: Record<string, string | number | undefined>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, query } = opts;
  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
      cache: "no-store",
    });
  } catch {
    throw new CoreOfflineError();
  } finally {
    clearTimeout(timer);
  }

  const text = await res.text();
  const parsed: unknown = text ? safeJson(text) : undefined;

  if (!res.ok) {
    const message = extractMessage(parsed) ?? `Request failed with status ${res.status}`;
    throw new ApiError(res.status, message, parsed);
  }
  return parsed as T;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Pull a human message out of the gateway's structured error envelope. */
function extractMessage(parsed: unknown): string | undefined {
  if (typeof parsed !== "object" || parsed === null) return undefined;
  const obj = parsed as Record<string, unknown>;
  const err = obj.error;
  if (typeof err === "object" && err !== null) {
    const m = (err as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  if (typeof obj.detail === "string") return obj.detail;
  return undefined;
}

/* ── Endpoints ── */

export const api = {
  health(): Promise<{ status: string; services: Record<string, string>; version: string }> {
    return request("/api/v1/health");
  },

  protect(body: ProtectBody, token?: string): Promise<ProtectResult> {
    return request("/api/v1/protect", { method: "POST", body, token });
  },

  access(body: AccessBody, token?: string): Promise<AccessResult> {
    return request("/api/v1/access", { method: "POST", body, token });
  },

  verify(evidence: AuditEntry): Promise<VerifyResult> {
    return request("/api/v1/verify", { method: "POST", body: { evidence } });
  },

  evidenceLog(query?: { resource_id?: string; actor_id?: string; page?: number; page_size?: number }): Promise<EvidenceLog> {
    return request("/api/v1/evidence/log", { query });
  },

  keysList(): Promise<KeyListResponse> {
    return request("/api/v1/keys");
  },

  keysGenerate(body: { algorithm?: string; type?: string; organization?: string; owner?: string }, token?: string): Promise<ManagedKey> {
    return request("/api/v1/keys/generate", { method: "POST", body, token });
  },

  keysRotate(keyId: string, token?: string): Promise<{ old_key_id: string; new_key_id: string; rotated_at: string }> {
    return request(`/api/v1/keys/rotate/${encodeURIComponent(keyId)}`, { method: "POST", token });
  },

  keysRevoke(keyId: string, token?: string): Promise<{ key_id: string; revoked_at: string }> {
    return request(`/api/v1/keys/revoke/${encodeURIComponent(keyId)}`, { method: "POST", token });
  },

  policyEvaluate(body: EvaluateBody): Promise<EvaluationResult> {
    return request("/api/v1/policy/evaluate", { method: "POST", body });
  },
};

/** Best-effort health probe: returns null when the core is offline. */
export async function probeHealth() {
  try {
    return await api.health();
  } catch {
    return null;
  }
}
