/**
 * SDK configuration.
 *
 * A single module-level config drives every verb, exactly like the Python SDK's
 * `configure()` / `get_config()`. It is mutated in place by `configure()` so the
 * verb functions can be imported and called directly (`import { protect } ...`).
 *
 * The JS SDK talks to the **gateway over REST**, so the relevant address is the
 * gateway URL (default `http://localhost:8000`), not the gRPC core address. We
 * still accept `coreAddress` for parity with the blueprint's example, but the
 * REST transport ignores it.
 */

/** A `fetch` implementation. Defaults to the runtime global (Node 18+/browser). */
export type FetchLike = typeof globalThis.fetch;

export interface PrivyQConfig {
  /** Base URL of the PrivyQ gateway, e.g. "http://localhost:8000". */
  gatewayUrl: string;
  /** gRPC core address (accepted for parity; unused by the REST transport). */
  coreAddress?: string;
  /** Sent as the `X-API-Key` header when set. */
  apiKey?: string;
  /** Sent as `Authorization: Bearer <token>` when set. */
  token?: string;
  /** Default KEM algorithm for `protect` (falls back to the core's default). */
  defaultAlgorithm: string;
  /** Default signature scheme for `seal`. */
  defaultSignature: string;
  /** Per-request timeout in milliseconds. */
  timeoutMs: number;
  /** Whether the caller wants audit evidence emitted (advisory; core decides). */
  auditEnabled: boolean;
  /** Whether to verify evidence chains on retrieval (advisory). */
  verifyEvidence: boolean;
  /** Extra headers merged into every request. */
  headers?: Record<string, string>;
  /** Custom fetch (for tests, or Node < 18 with a polyfill). */
  fetch?: FetchLike;
}

/** Options accepted by {@link configure}. Accepts `gatewayUrl` or `coreAddress`. */
export type ConfigureOptions = Partial<PrivyQConfig>;

function readEnv(name: string): string | undefined {
  // Guarded so the SDK is safe in the browser where `process` is undefined.
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  return proc?.env?.[name];
}

function defaults(): PrivyQConfig {
  return {
    gatewayUrl:
      readEnv("PRIVYQ_GATEWAY_URL") ?? readEnv("NEXT_PUBLIC_API_URL") ?? "http://localhost:8000",
    apiKey: readEnv("PRIVYQ_API_KEY"),
    defaultAlgorithm: readEnv("PRIVYQ_ALGORITHM") ?? "kyber_768",
    defaultSignature: readEnv("PRIVYQ_SIGNATURE") ?? "dilithium_3",
    timeoutMs: Number(readEnv("PRIVYQ_TIMEOUT_MS") ?? "6000"),
    auditEnabled: (readEnv("PRIVYQ_AUDIT") ?? "true").toLowerCase() === "true",
    verifyEvidence: true,
  };
}

let _config: PrivyQConfig = defaults();

const KNOWN_KEYS: (keyof PrivyQConfig)[] = [
  "gatewayUrl",
  "coreAddress",
  "apiKey",
  "token",
  "defaultAlgorithm",
  "defaultSignature",
  "timeoutMs",
  "auditEnabled",
  "verifyEvidence",
  "headers",
  "fetch",
];

/**
 * Update the global SDK configuration. Returns the merged config.
 *
 * @example
 * configure({ gatewayUrl: "https://api.privyq.example", apiKey: "pk_live_…" });
 */
export function configure(options: ConfigureOptions = {}): PrivyQConfig {
  for (const key of Object.keys(options) as (keyof PrivyQConfig)[]) {
    if (!KNOWN_KEYS.includes(key)) {
      throw new Error(`unknown configuration option: ${String(key)}`);
    }
  }
  // A gRPC-style address passed as gatewayUrl (host:port, no scheme) is a common
  // mistake; leave it to the caller but normalize trailing slashes.
  const next: PrivyQConfig = { ..._config, ...options };
  next.gatewayUrl = next.gatewayUrl.replace(/\/+$/, "");
  _config = next;
  return _config;
}

/** Return the current configuration (a live reference — do not mutate). */
export function getConfig(): PrivyQConfig {
  return _config;
}

/** Reset configuration to defaults. Primarily for tests. */
export function resetConfig(): PrivyQConfig {
  _config = defaults();
  return _config;
}
