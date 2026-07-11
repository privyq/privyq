import Link from "next/link";
import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const PROTECT = {
  python: `protected = protect(
    "Patient: John Doe. Plan: continue beta-blocker.",
    policy={
        "role": "doctor",
        "department": ["cardiology", "oncology"],
        "purpose": "treatment",
        "expiry": "24h",
    },
    actor={"user_id": "dr_smith", "role": "doctor", "department": "cardiology"},
)

protected.resource_id          # id of the protected resource
protected.algorithm            # e.g. "kyber_768"
blob = protected.to_bytes()    # the sealed envelope (ciphertext + embedded policy)`,
  typescript: `const protectedData = await protect(
  "Patient: John Doe. Plan: continue beta-blocker.",
  {
    role: "doctor",
    department: ["cardiology", "oncology"],
    purpose: "treatment",
    expiry: "24h",
  },
  { actor: { userId: "dr_smith", role: "doctor", department: "cardiology" } },
);

protectedData.resourceId;          // id of the protected resource
protectedData.algorithm;           // e.g. "kyber_768"
const blob = protectedData.toBytes(); // the sealed envelope (ciphertext + embedded policy)`,
};

const ACCESS = {
  python: `result = access(
    protected,
    identity={"role": "doctor", "department": "cardiology", "purpose": "treatment"},
)
result.data      # bytes
result.text      # str  (decoded convenience property)
result.receipt   # the signed access receipt (evidence)`,
  typescript: `const result = await access(
  protectedData,
  { role: "doctor", department: "cardiology", purpose: "treatment" },
  { purpose: "treatment" },
);
result.data           // Uint8Array
await result.text();  // string
result.evidence;      // the signed access receipt`,
};

const DENIED = {
  python: `from privyq import PolicyViolationError

try:
    access(protected, identity={"role": "nurse"})
except PolicyViolationError as e:
    print(e)          # -> the policy reason, e.g. "role condition failed"
    # The denied attempt is still written to the tamper-evident audit chain.`,
  typescript: `import { AccessDenied } from "@privyq/sdk";

try {
  await access(protectedData, { role: "nurse" });
} catch (e) {
  if (e instanceof AccessDenied) {
    console.log(e.reason); // the policy reason
    // The denied attempt is still written to the tamper-evident audit chain.
  }
}`,
};

export default function ProtectAccess() {
  return (
    <DocBody>
      <H3>protect</H3>
      <P>
        <Code>protect</Code> encrypts data and embeds its access policy in the same call, returning a{" "}
        <Code>ProtectedData</Code> envelope. The rules travel with the ciphertext — there is no separate permissions
        table to misconfigure or bypass.
      </P>
      <CodeTabs python={PROTECT.python} typescript={PROTECT.typescript} />
      <DataTable
        head={["ProtectedData", "Python", "TypeScript"]}
        rows={[
          ["Resource id", <Code key="a">.resource_id</Code>, <Code key="b">.resourceId</Code>],
          ["Algorithm", <Code key="c">.algorithm</Code>, <Code key="d">.algorithm</Code>],
          ["Protect evidence", <Code key="e">.receipt / evidence</Code>, <Code key="f">.evidence</Code>],
          ["Serialize", <Code key="g">.to_bytes()</Code>, <Code key="h">.toBytes()</Code>],
        ]}
      />

      <H3>access</H3>
      <P>
        <Code>access</Code> authorizes the caller against the embedded policy and — only if it passes — reveals the
        plaintext. It is <Code>check</Code> + reveal, and it emits evidence whether it grants or denies.
      </P>
      <CodeTabs python={ACCESS.python} typescript={ACCESS.typescript} />

      <H3>Denials carry a reason</H3>
      <P>
        A denied access raises — <Code>PolicyViolationError</Code> in Python, <Code>AccessDenied</Code> in TypeScript
        — carrying the same human reason the <Code>Decision</Code> would give:
      </P>
      <CodeTabs python={DENIED.python} typescript={DENIED.typescript} />

      <Callout tone="blue">
        Need the decision without revealing data — for a request path that gates an action rather than a blob? Use{" "}
        <Link href="/docs/check-explain">check &amp; explain</Link>.
      </Callout>
    </DocBody>
  );
}
