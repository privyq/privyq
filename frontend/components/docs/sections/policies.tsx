import Link from "next/link";
import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const SHORTHAND = {
  python: `policy = {
    "role": "doctor",
    "department": ["cardiology", "oncology"],  # a list becomes an "in" check
    "purpose": "treatment",                    # purpose limitation, first-class
    "expiry": "24h",                           # relative duration or absolute date
}
protect(record, policy=policy)`,
  typescript: `const policy = {
  role: "doctor",
  department: ["cardiology", "oncology"],  // a list becomes an "in" check
  purpose: "treatment",                    // purpose limitation, first-class
  expiry: "24h",                           // relative duration or absolute date
};
await protect(record, policy);`,
};

const STRUCTURED = {
  python: `policy = {
    "policy_id": "medical-record-v2",
    "conditions": [
        {"type": "role", "operator": "in", "value": ["doctor", "researcher"]},
        {"type": "purpose", "operator": "equals", "value": "treatment"},
        {"type": "approval_limit", "operator": "gte", "value": 1_000_000},  # generic attribute
    ],
    "combination": "all",                 # all | any | custom
    "deny_conditions": [                  # deny overrides allow
        {"type": "location", "operator": "not_in", "value": ["NG", "GH"]},
    ],
    "obligations": ["mask:patient_name", "log", "ttl:1h"],
}`,
  typescript: `const policy = {
  policy_id: "medical-record-v2",
  conditions: [
    { type: "role", operator: "in", value: ["doctor", "researcher"] },
    { type: "purpose", operator: "equals", value: "treatment" },
    { type: "approval_limit", operator: "gte", value: 1_000_000 }, // generic attribute
  ],
  combination: "all",                  // all | any | custom
  deny_conditions: [                   // deny overrides allow
    { type: "location", operator: "not_in", value: ["NG", "GH"] },
  ],
  obligations: ["mask:patient_name", "log", "ttl:1h"],
};`,
};

const CUSTOM = {
  python: `policy = {
    "policy_id": "invoice-approval-v3",
    "combination": "custom",
    "custom_logic": 'role == "manager" and (amount <= approval_limit or emergency)',
    "obligations": ["log", "mask:account_no"],
}
# emergency=true is break-glass: it satisfies an otherwise-failing rule, and is
# always flagged distinctly in the evidence.`,
  typescript: `const policy = {
  policy_id: "invoice-approval-v3",
  combination: "custom",
  custom_logic: 'role == "manager" and (amount <= approval_limit or emergency)',
  obligations: ["log", "mask:account_no"],
};
// emergency=true is break-glass: it satisfies an otherwise-failing rule, and is
// always flagged distinctly in the evidence.`,
};

export default function Policies() {
  return (
    <DocBody>
      <P>
        A policy describes who may access data — and, because PrivyQ evaluates attributes across the ABAC quadrant
        (subject, resource, action/purpose, environment), it is far more expressive than roles alone. There are two
        shapes: <strong>shorthand</strong> and <strong>structured</strong>.
      </P>

      <H3>Shorthand</H3>
      <P>Concise, one key per condition — a list becomes an <Code>in</Code> check, <Code>expiry</Code> a <Code>before</Code>.</P>
      <CodeTabs python={SHORTHAND.python} typescript={SHORTHAND.typescript} />

      <H3>Structured — generic attributes, deny, obligations</H3>
      <P>
        The structured form gives you the full operator set on <strong>any</strong> attribute (not just a built-in
        registry), a <Code>deny</Code> block that overrides <Code>allow</Code>, and <Code>obligations</Code>.
      </P>
      <CodeTabs python={STRUCTURED.python} typescript={STRUCTURED.typescript} />
      <DataTable
        head={["Group", "Operators"]}
        rows={[
          ["Equality", <span key="a" className="font-mono text-[.8rem] text-muted">equals · not_equals · negate</span>],
          ["Membership", <span key="b" className="font-mono text-[.8rem] text-muted">in · not_in · contains</span>],
          ["Ordering / time", <span key="c" className="font-mono text-[.8rem] text-muted">before · after · between</span>],
          ["Numeric", <span key="d" className="font-mono text-[.8rem] text-muted">gt · gte · lt · lte</span>],
          ["String", <span key="e" className="font-mono text-[.8rem] text-muted">starts_with · ends_with</span>],
        ]}
      />

      <H3>custom_logic — a real expression engine</H3>
      <P>
        When <Code>combination</Code> is <Code>custom</Code>, PrivyQ evaluates a sandboxed boolean expression over
        attributes (no arbitrary code) — <Code>and</Code>/<Code>or</Code>/<Code>not</Code>, comparisons, and
        parentheses.
      </P>
      <CodeTabs python={CUSTOM.python} typescript={CUSTOM.typescript} />

      <H3>Obligations</H3>
      <P>
        Obligations turn &ldquo;yes/no&rdquo; into &ldquo;yes, but&hellip;&rdquo;. They are returned on a grant and
        the enforcement point must honour them: <Code>mask:field</Code>, <Code>redact:field</Code>,{" "}
        <Code>watermark</Code>, <Code>require_mfa</Code>, <Code>notify:channel</Code>, <Code>ttl:duration</Code>.
      </P>

      <Callout tone="mint">
        Compose these policies interactively — with the resulting matched/failed conditions and obligations — in the{" "}
        <Link href="/explorer">Decision Explorer</Link>.
      </Callout>
    </DocBody>
  );
}
