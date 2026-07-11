import Link from "next/link";
import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const CHECK = {
  python: `decision = check(
    {"role": "reviewer", "department": "finance", "approval_limit": 5_000_000},
    resource=invoice,          # a ProtectedData, or pass policy=...
    purpose="approval",
)

decision.allowed        # False
decision.reason         # "Role 'Reviewer' cannot approve invoices above ₦5,000,000."
decision.matched        # ["role", "department"]
decision.failed         # ["approval_limit"]
decision.obligations    # [] on a denial; ["mask:account_no", "log"] on a grant
decision.policy_id      # "invoice-approval-v3"

if not decision:        # Decision is truthy iff allowed
    return http_403(explain(decision))`,
  typescript: `const decision = await check(
  { role: "reviewer", department: "finance", approval_limit: 5_000_000 },
  invoice,                 // a ProtectedData, or a policy object
  { purpose: "approval" },
);

decision.allowed;        // false
decision.reason;         // "Role 'Reviewer' cannot approve invoices above ₦5,000,000."
decision.matched;        // ["role", "department"]
decision.failed;         // ["approval_limit"]
decision.obligations;    // [] on a denial; ["mask:account_no", "log"] on a grant
decision.policyId;       // "invoice-approval-v3"

if (!decision.allowed) {
  return http403(explain(decision));
}`,
};

const EXPLAIN = {
  python: `msg = explain(decision)   # str — the same text as decision.reason
# "Role 'Reviewer' cannot approve invoices above ₦5,000,000."`,
  typescript: `const msg = explain(decision); // string — the same text as decision.reason
// "Role 'Reviewer' cannot approve invoices above ₦5,000,000."`,
};

const PDP = {
  python: `# Any service can call the PDP for a consistent answer — no data revealed.
if check({"role": role, "wallet": wallet}, policy=transfer_policy, purpose="transfer"):
    execute_transfer()`,
  typescript: `// Any service can call the PDP for a consistent answer — no data revealed.
if ((await check({ role, wallet }, transferPolicy, { purpose: "transfer" })).allowed) {
  executeTransfer();
}`,
};

export default function CheckExplain() {
  return (
    <DocBody>
      <H3>check</H3>
      <P>
        <Code>check</Code> is the pure authorization decision. It never touches plaintext — it is the verb a service
        calls in a request path to gate an action that is not itself an encrypted blob (a transfer, an API call, a
        model invocation). It returns a <Code>Decision</Code>.
      </P>
      <CodeTabs python={CHECK.python} typescript={CHECK.typescript} />

      <H3>The Decision</H3>
      <P>Every decision is explainable, deterministic, and logged. A denial is never a silent 403.</P>
      <DataTable
        head={["Field", "Python", "TypeScript", "Meaning"]}
        rows={[
          ["allowed", <Code key="a">.allowed</Code>, <Code key="b">.allowed</Code>, "Granted or denied."],
          ["reason", <Code key="c">.reason</Code>, <Code key="d">.reason</Code>, "Human-readable why."],
          ["matched", <Code key="e">.matched</Code>, <Code key="f">.matched</Code>, "Conditions that passed."],
          ["failed", <Code key="g">.failed</Code>, <Code key="h">.failed</Code>, "Conditions that failed."],
          ["obligations", <Code key="i">.obligations</Code>, <Code key="j">.obligations</Code>, "Side-effects to honour on a grant."],
          ["policy id", <Code key="k">.policy_id</Code>, <Code key="l">.policyId</Code>, "Which policy decided."],
        ]}
      />
      <Callout tone="blue">
        In Python a <Code>Decision</Code> is <strong>truthy</strong> when allowed — <Code>if decision:</Code> works.
        In TypeScript read <Code>decision.allowed</Code>.
      </Callout>

      <H3>explain</H3>
      <P><Code>explain</Code> renders the human reason for a decision — perfect for a 403 body, a log line, or UX.</P>
      <CodeTabs python={EXPLAIN.python} typescript={EXPLAIN.typescript} />

      <H3>One policy brain across services</H3>
      <P>
        Because <Code>check</Code> reveals nothing and answers from one core, every service gets the same decision —
        tested once, provable in the audit trail.
      </P>
      <CodeTabs python={PDP.python} typescript={PDP.typescript} />
      <Callout tone="mint">
        Try these decisions live in the <Link href="/explorer">Decision Explorer</Link> — including banking
        break-glass, AI credits, and delegated-counsel scenarios.
      </Callout>
    </DocBody>
  );
}
