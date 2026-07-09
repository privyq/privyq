/**
 * Typed client for the PrivyQ FastAPI gateway (docs/blueprint.md Appendix B).
 *
 * Base URL comes from NEXT_PUBLIC_API_URL (default http://localhost:8000).
 * Every call has a short timeout and turns network failures into a typed
 * `CoreOfflineError`, so the demo UI can render graceful "core offline" states
 * instead of crashing when the gateway/core is unreachable.
 *
 * TODO(F2): regenerate request/response types from the gateway OpenAPI spec via
 *   openapi-typescript and import them here instead of lib/types.ts (see CONTRIBUTING.md).
 */
import type {
  AccessRequest,
  AccessResponse,
  EvidenceLogQuery,
  EvidenceLogResponse,
  HealthResponse,
  KeyGenerateRequest,
  KeyResponse,
  KeyRevokeResponse,
  KeyRotateResponse,
  ProtectRequest,
  ProtectResponse,
  VerifyRequest,
  VerifyResponse,
} from "@/lib/types";

export const API_BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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
  signal?: AbortSignal;
  /** Bearer token for the Authorization header (Appendix B). */
  token?: string;
  query?: Record<string, string | number | undefined>;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, token, query } = opts;

  const url = new URL(`${API_BASE}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
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
      signal: opts.signal ?? controller.signal,
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
    const message =
      (isRecord(parsed) &&
        (asString(parsed.details) ||
          asString(parsed.error) ||
          asString(parsed.message))) ||
      `Request failed with status ${res.status}`;
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

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

/* ── Endpoints (Appendix B) ── */

export const api = {
  health(signal?: AbortSignal): Promise<HealthResponse> {
    return request<HealthResponse>("/api/v1/health", { signal });
  },

  protect(body: ProtectRequest, token?: string): Promise<ProtectResponse> {
    return request<ProtectResponse>("/api/v1/protect", {
      method: "POST",
      body,
      token,
    });
  },

  access(body: AccessRequest, token?: string): Promise<AccessResponse> {
    return request<AccessResponse>("/api/v1/access", {
      method: "POST",
      body,
      token,
    });
  },

  verify(body: VerifyRequest): Promise<VerifyResponse> {
    return request<VerifyResponse>("/api/v1/verify", {
      method: "POST",
      body,
    });
  },

  evidenceLog(query?: EvidenceLogQuery): Promise<EvidenceLogResponse> {
    return request<EvidenceLogResponse>("/api/v1/evidence/log", {
      query: query
        ? {
            page: query.page,
            page_size: query.page_size,
            resource_id: query.resource_id,
            actor_id: query.actor_id,
            start_time: query.start_time,
            end_time: query.end_time,
          }
        : undefined,
    });
  },

  keysGenerate(body: KeyGenerateRequest, token?: string): Promise<KeyResponse> {
    return request<KeyResponse>("/api/v1/keys/generate", {
      method: "POST",
      body,
      token,
    });
  },

  keysRotate(keyId: string, token?: string): Promise<KeyRotateResponse> {
    return request<KeyRotateResponse>(
      `/api/v1/keys/rotate/${encodeURIComponent(keyId)}`,
      { method: "POST", token },
    );
  },

  keysRevoke(keyId: string, token?: string): Promise<KeyRevokeResponse> {
    return request<KeyRevokeResponse>(
      `/api/v1/keys/revoke/${encodeURIComponent(keyId)}`,
      { method: "POST", token },
    );
  },
};

/** Best-effort health probe: returns null when the core is offline. */
export async function probeHealth(): Promise<HealthResponse | null> {
  try {
    return await api.health();
  } catch {
    return null;
  }
}
