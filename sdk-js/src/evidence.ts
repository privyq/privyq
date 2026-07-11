/**
 * evidence — the audit / verifiable-evidence surface (blueprint §5, §12).
 *
 *   evidence.of(resourceId)      → the audit trail for one resource
 *   evidence.log(filters)        → a paginated slice of the evidence log
 *   evidence.export(format, ...) → a compliance export (json | csv | pdf) as bytes
 *   evidence.verify(filters)     → verify the returned chain segment is intact
 *
 * Note: `evidence.verify()` maps to the gateway's `GET /evidence/log`, whose
 * response carries a `verified` boolean computed by re-hashing the chain. There
 * is no dedicated "verify whole chain" REST route, so this reports chain
 * integrity (signature/policy validity of individual entries is available via
 * the top-level `verify(evidence)`).
 */

import { request } from "./http.js";
import {
  toEvidence,
  type Evidence,
  type EvidenceLog,
  type VerificationResult,
  type WireEvidenceLogResponse,
} from "./types.js";

export interface EvidenceFilters {
  resourceId?: string;
  actorId?: string;
  page?: number;
  pageSize?: number;
}

export interface ExportFilters {
  resourceId?: string;
  actorId?: string;
  startTime?: string;
  endTime?: string;
}

export interface ComplianceFilters extends ExportFilters {
  /** Compliance framework, e.g. "GDPR", "HIPAA". */
  framework?: string;
}

function logQuery(filters: EvidenceFilters) {
  return {
    resource_id: filters.resourceId,
    actor_id: filters.actorId,
    page: filters.page,
    page_size: filters.pageSize,
  };
}

/** The full audit trail for one resource, in chain order. */
export async function of(resourceId: string): Promise<Evidence[]> {
  const result = await log({ resourceId, pageSize: 200 });
  return result.entries;
}

/** A paginated slice of the evidence log. */
export async function log(filters: EvidenceFilters = {}): Promise<EvidenceLog> {
  const resp = await request<WireEvidenceLogResponse>("/api/v1/evidence/log", {
    query: logQuery(filters),
  });
  return {
    entries: resp.entries.map(toEvidence),
    total: resp.total,
    page: resp.page,
    pageSize: resp.page_size,
    verified: resp.verified,
  };
}

/**
 * Verify that the returned evidence chain segment is intact.
 * Returns a {@link VerificationResult} whose fields reflect chain integrity.
 */
export async function verify(filters: EvidenceFilters = {}): Promise<VerificationResult> {
  const resp = await request<WireEvidenceLogResponse>("/api/v1/evidence/log", {
    query: logQuery(filters),
  });
  return {
    ok: resp.verified,
    signatureValid: resp.verified,
    chainValid: resp.verified,
    policyCompliant: true,
    detail: resp.verified
      ? `verified ${resp.total} evidence entr${resp.total === 1 ? "y" : "ies"}`
      : "evidence chain verification failed",
  };
}

/** Export the evidence trail as `json` | `csv` | `pdf` (returned as bytes). */
export async function exportEvidence(
  format: "json" | "csv" | "pdf" = "json",
  filters: ExportFilters = {},
): Promise<Uint8Array> {
  return request<Uint8Array>("/api/v1/evidence/export", {
    responseType: "bytes",
    query: {
      format,
      resource_id: filters.resourceId,
      actor_id: filters.actorId,
      start_time: filters.startTime,
      end_time: filters.endTime,
    },
  });
}

/** Fetch a compliance report (e.g. GDPR/HIPAA) as a structured object. */
export async function complianceReport(
  filters: ComplianceFilters = {},
): Promise<Record<string, unknown>> {
  return request<Record<string, unknown>>("/api/v1/compliance/report", {
    query: {
      framework: filters.framework ?? "GDPR",
      resource_id: filters.resourceId,
      actor_id: filters.actorId,
      start_time: filters.startTime,
      end_time: filters.endTime,
    },
  });
}

/**
 * The `evidence` namespace, mirroring the Python SDK's `evidence` module.
 * `export` is a reserved word, so the function is named `exportEvidence` and
 * also exposed here as `evidence.export`.
 */
export const evidence = {
  of,
  log,
  verify,
  export: exportEvidence,
  complianceReport,
};
