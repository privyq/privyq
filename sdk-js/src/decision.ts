/**
 * check() / explain() — the pure authorization decision (blueprint §5, §6).
 *
 * `check` never reveals data. Pass a resource whose embedded policy is evaluated
 * (a {@link ProtectedData} or its envelope string) or an explicit `Policy` object.
 * Every {@link Decision} explains itself via `decision.reason`; `explain()` is
 * sugar over that, matching the Python SDK (it is a local, network-free helper).
 */

import { request } from "./http.js";
import { ProtectedData } from "./protect.js";
import {
  type Context,
  type Decision,
  type Identity,
  type Policy,
  type WireCheckRequest,
  type WireDecisionResponse,
} from "./types.js";

export interface CheckOptions {
  /** Purpose of access; merged into the identity for evaluation. */
  purpose?: string;
  /** Optional request context. */
  context?: Context;
  /** Ask the core to record a signed evidence entry for this decision. */
  emitEvidence?: boolean;
}

/** A resource whose embedded policy is evaluated, or an explicit policy. */
export type CheckTarget = ProtectedData | string | Policy;

function decisionFromResponse(r: WireDecisionResponse): Decision {
  return {
    allowed: r.allowed,
    reason: r.reason,
    matched: r.matched ?? [],
    failed: r.failed ?? [],
    obligations: r.obligations ?? [],
    policyId: r.policy_id,
    evaluatedAt: r.evaluated_at,
    evaluatedConditions: r.evaluated_conditions ?? [],
    evidence: r.evidence ?? null,
  };
}

export async function check(
  identity: Identity,
  target: CheckTarget,
  opts: CheckOptions = {},
): Promise<Decision> {
  const ident: Identity = opts.purpose ? { ...identity, purpose: opts.purpose } : identity;
  const reqBody: WireCheckRequest = {
    identity: ident,
    context: opts.context ?? null,
    emit_evidence: opts.emitEvidence ?? false,
  };
  if (target instanceof ProtectedData) {
    reqBody.protected_data = target.envelope;
  } else if (typeof target === "string") {
    reqBody.protected_data = target;
  } else if (target && typeof target === "object") {
    reqBody.policy = target;
  }
  const resp = await request<WireDecisionResponse>("/api/v1/check", {
    method: "POST",
    body: reqBody,
  });
  return decisionFromResponse(resp);
}

/** Human-readable reason for a decision (sugar over `decision.reason`). */
export function explain(decision: Decision): string {
  return decision.reason;
}
