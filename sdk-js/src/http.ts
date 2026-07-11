/**
 * REST transport for the PrivyQ gateway.
 *
 * One `request()` helper handles URL/query building, auth headers, timeouts,
 * JSON (or binary) responses, and mapping non-2xx responses + network failures
 * onto the typed error hierarchy. Every verb goes through it.
 */

import { getConfig, type FetchLike } from "./config.js";
import {
  ConfigurationError,
  CoreUnavailableError,
  TimeoutError,
  errorForStatus,
  type PrivyQError,
} from "./errors.js";

export type QueryValue = string | number | boolean | undefined;

export interface RequestOptions {
  method?: "GET" | "POST";
  /** JSON body (POST). */
  body?: unknown;
  /** Query parameters; undefined/empty-string values are omitted. */
  query?: Record<string, QueryValue>;
  /** How to read a successful response body. */
  responseType?: "json" | "bytes";
}

function resolveFetch(custom: FetchLike | undefined): FetchLike {
  const fn = custom ?? globalThis.fetch;
  if (typeof fn !== "function") {
    throw new ConfigurationError(
      "no fetch implementation available — use Node 18+ / a browser, or pass configure({ fetch })",
    );
  }
  return fn;
}

function buildUrl(base: string, path: string, query?: Record<string, QueryValue>): string {
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/** Pull a human message out of the gateway's error envelope or FastAPI detail. */
function extractMessage(parsed: unknown): string | undefined {
  if (typeof parsed !== "object" || parsed === null) {
    return typeof parsed === "string" && parsed ? parsed : undefined;
  }
  const obj = parsed as Record<string, unknown>;
  const err = obj.error;
  if (typeof err === "object" && err !== null) {
    const m = (err as Record<string, unknown>).message;
    if (typeof m === "string") return m;
  }
  if (typeof obj.detail === "string") return obj.detail;
  if (Array.isArray(obj.detail) && obj.detail.length > 0) {
    // FastAPI 422 validation errors: [{ loc, msg, type }, ...]
    const first = obj.detail[0] as Record<string, unknown>;
    if (first && typeof first.msg === "string") return first.msg;
  }
  return undefined;
}

/** Perform a request and return the typed body, or throw a {@link PrivyQError}. */
export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const config = getConfig();
  const { method = "GET", body, query, responseType = "json" } = opts;
  const doFetch = resolveFetch(config.fetch);
  const url = buildUrl(config.gatewayUrl, path, query);

  const headers: Record<string, string> = { Accept: "application/json", ...config.headers };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (config.apiKey) headers["X-API-Key"] = config.apiKey;
  if (config.token) headers["Authorization"] = `Bearer ${config.token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.timeoutMs);

  let res: Response;
  try {
    res = await doFetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (cause) {
    if (cause instanceof Error && cause.name === "AbortError") {
      throw new TimeoutError(`request to ${path} timed out after ${config.timeoutMs}ms`);
    }
    throw new CoreUnavailableError(`could not reach PrivyQ gateway at ${config.gatewayUrl}`, {
      body: cause,
    });
  } finally {
    clearTimeout(timer);
  }

  if (responseType === "bytes") {
    if (!res.ok) throw await errorFromResponse(res);
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf) as unknown as T;
  }

  const text = await res.text();
  const parsed = text ? safeJson(text) : undefined;
  if (!res.ok) {
    const message = extractMessage(parsed) ?? `request failed with status ${res.status}`;
    throw errorForStatus(res.status, message, parsed);
  }
  return parsed as T;
}

async function errorFromResponse(res: Response): Promise<PrivyQError> {
  const text = await res.text().catch(() => "");
  const parsed = text ? safeJson(text) : undefined;
  const message = extractMessage(parsed) ?? `request failed with status ${res.status}`;
  return errorForStatus(res.status, message, parsed);
}
