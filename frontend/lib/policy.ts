import type {
  EvaluatedCondition,
  Identity,
  Policy,
  PolicyCondition,
  PolicyEvaluation,
} from "./types";

/**
 * Client-side policy evaluator.
 *
 * NOTE: In the real system, policy is evaluated ONLY inside the Go core
 * (policy evaluation and decryption happen only in the core).
 * This is a *local mirror* used purely for the offline demo fallback, so the
 * playground and access flows still work when the gateway is unreachable.
 * It intentionally mirrors the simple equality/membership logic in
 * the original design prototype and must never be treated as authoritative.
 */

/**
 * Attributes of the resource being accessed. Policy conditions like
 * `classification` and `jurisdiction` describe the *resource*, not the actor,
 * so they resolve against these values rather than the identity. When omitted
 * (e.g. the playground, which tests identity only) they resolve to "".
 */
export interface ResourceAttributes {
  classification?: string;
  jurisdiction?: string;
}

function attributeValue(
  identity: Identity,
  type: string,
  resource?: ResourceAttributes,
): string {
  const map: Record<string, string | undefined> = {
    role: identity.role,
    department: identity.department,
    purpose: identity.purpose,
    organization: identity.organization,
    // resource-scoped attributes
    classification: resource?.classification,
    jurisdiction: resource?.jurisdiction,
  };
  return map[type] ?? "";
}

function evaluateCondition(
  condition: PolicyCondition,
  identity: Identity,
  resource?: ResourceAttributes,
): EvaluatedCondition {
  const actual = attributeValue(identity, condition.type, resource);
  const expected = condition.value;
  let result = false;

  switch (condition.operator) {
    case "equals":
      result = actual === expected;
      break;
    case "not_equals":
      result = actual !== expected;
      break;
    case "in":
    case "one_of":
      result = Array.isArray(expected)
        ? expected.includes(actual)
        : actual === expected;
      break;
    case "before":
      // temporal conditions (expiry) always pass in the demo window
      result = true;
      break;
    case "after":
      result = true;
      break;
    default:
      result = false;
  }

  return { type: condition.type, expected, actual, result };
}

export function evaluatePolicy(
  policy: Policy,
  identity: Identity,
  resource?: ResourceAttributes,
): PolicyEvaluation {
  const evaluated = policy.conditions.map((c) =>
    evaluateCondition(c, identity, resource),
  );
  const granted =
    policy.combination === "any"
      ? evaluated.some((e) => e.result)
      : evaluated.every((e) => e.result);

  const firstFail = evaluated.find((e) => !e.result);
  const reason = granted
    ? "All conditions satisfied"
    : firstFail
      ? `${firstFail.type} condition failed: expected ` +
        `${JSON.stringify(firstFail.expected)}, got '${firstFail.actual || "—"}'`
      : "Policy not satisfied";

  return {
    decision: granted ? "granted" : "denied",
    reason,
    evaluated_conditions: evaluated,
  };
}

/** Human-readable summary line for a condition (used by PolicyEditor previews). */
export function describeCondition(c: PolicyCondition): string {
  const value = Array.isArray(c.value) ? c.value.join(", ") : c.value;
  return `${c.type} ${c.operator.replace("_", " ")} ${value}`;
}
