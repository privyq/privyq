/**
 * PrivyQ v2 (JS) — the PDP `check()` verb: describe policies, don't write auth code.
 *
 * Start the stack, then:
 *   npm --prefix ../../sdk-js run build
 *   PRIVYQ_GATEWAY_URL=http://localhost:8000 node 01_pdp_check.mjs
 *
 * Mirrors examples/python/01_pdp_check.py — the banking approval-limit scenario
 * with break-glass, replacing an if-ladder with one policy and one check().
 */
import { configure, check, explain } from "@privyq/sdk";

configure({ gatewayUrl: process.env.PRIVYQ_GATEWAY_URL ?? "http://localhost:8000" });

// One policy, written once — instead of a pile of `if` statements per endpoint.
const policy = {
  combination: "custom",
  custom_logic: 'role == "manager" and (amount <= approval_limit or emergency)',
};

async function canApprove(user) {
  const decision = await check(user, policy);
  const who = user.user_id ?? user.role;
  if (decision.allowed) {
    console.log(`  ✅ ${who}: APPROVED`);
  } else {
    console.log(`  ❌ ${who}: DENIED — ${explain(decision)}`);
  }
}

console.log("Loan approval decisions (no authorization code, just a policy):");
await canApprove({ user_id: "amaka", role: "manager", attributes: { amount: "500000", approval_limit: "1000000" } });
await canApprove({ user_id: "bello", role: "manager", attributes: { amount: "5000000", approval_limit: "1000000" } });
await canApprove({ user_id: "chidi", role: "manager", attributes: { amount: "5000000", approval_limit: "1000000", emergency: "true" } });
await canApprove({ user_id: "dara", role: "clerk", attributes: { amount: "1", approval_limit: "100" } });
