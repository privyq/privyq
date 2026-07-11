import Link from "next/link";
import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const IMPORTS = {
  python: `import privyq
from privyq import (
    configure,
    protect, access, check, explain,   # decisions
    seal, verify,                      # signatures + verification
    evidence,                          # evidence.of / .log / .verify / .export
    generate_key, get_key, rotate_key, revoke_key,
)`,
  typescript: `import {
  configure,
  protect, access, check, explain,     // decisions
  seal, verify, verifyWallet,          // signatures + wallet identity
  evidence,                            // evidence.of / .log / .verify / .export
  generateKey, getKey, listKeys, rotateKey, revokeKey,
} from "@privyq/sdk";`,
};

const HELLO = {
  python: `configure(core_address="localhost:50051")

protected = protect("Patient: John Doe. Plan: beta-blocker.",
                    policy={"role": "doctor", "purpose": "treatment"})

decision = check({"role": "nurse"}, protected)   # -> Decision(allowed=False, reason=…)
record   = access(protected, {"role": "doctor", "purpose": "treatment"})
print(record.text)`,
  typescript: `configure({ gatewayUrl: "http://localhost:8000" });

const protectedData = await protect(
  "Patient: John Doe. Plan: beta-blocker.",
  { role: "doctor", purpose: "treatment" },
);

const decision = await check({ role: "nurse" }, protectedData); // Decision { allowed: false, reason: … }
const record   = await access(protectedData, { role: "doctor", purpose: "treatment" });
console.log(await record.text());`,
};

export default function Introduction() {
  return (
    <DocBody>
      <P>
        PrivyQ lets you <strong>describe access policies instead of writing authorization code</strong>. Instead of
        scattering <Code>if user.role != …</Code> checks across every service, you write the policy once and let
        PrivyQ make the decision, explain it, and record tamper-evident proof of it.
      </P>
      <P>
        The centre of gravity is the <strong>security decision</strong> — who <em>can</em> and <em>should</em> access
        something, given the full context. Because PrivyQ evaluates <strong>attributes</strong> (subject, resource,
        action/purpose, environment), not just roles, it is <strong>PBAC/ABAC</strong> and strictly more expressive
        than RBAC. Post-quantum encryption is the floor beneath it, not the headline.
      </P>

      <Callout tone="blue">
        Two SDKs, one vocabulary. The Python and TypeScript SDKs are peers — every verb, every type, and the same
        behaviour. Neither re-implements cryptography or policy; both call the Go core. Use the tabs on any code
        block to switch languages (your choice is remembered).
      </Callout>

      <H3>The verb vocabulary</H3>
      <P>PrivyQ never exposes <Code>encrypt</Code>/<Code>decrypt</Code>/<Code>sign</Code>. It exposes intent:</P>
      <DataTable
        head={["Verb", "Means"]}
        rows={[
          [<code key="v" className="font-mono text-[.82rem] text-blue">protect</code>, "Encrypt data and embed its policy."],
          [<code key="v" className="font-mono text-[.82rem] text-blue">access</code>, "Authorize against the embedded policy, then reveal — or deny with a reason."],
          [<code key="v" className="font-mono text-[.82rem] text-blue">check</code>, "The pure authorization decision — returns a Decision, reveals no data."],
          [<code key="v" className="font-mono text-[.82rem] text-blue">explain</code>, "Human-readable reason for a decision."],
          [<code key="v" className="font-mono text-[.82rem] text-blue">seal</code>, "Post-quantum digital signature over data."],
          [<code key="v" className="font-mono text-[.82rem] text-blue">verify</code>, "Verify audit evidence or a Sealed signature."],
          [<code key="v" className="font-mono text-[.82rem] text-blue">evidence.*</code>, "Query, verify, and export the audit trail."],
          [<code key="v" className="font-mono text-[.82rem] text-blue">keys</code>, "Generate, fetch, rotate, and revoke keys."],
        ]}
      />

      <H3>Import the SDK</H3>
      <CodeTabs python={IMPORTS.python} typescript={IMPORTS.typescript} />

      <H3>Hello, decision</H3>
      <P>Protect a record, deny the wrong caller, and reveal it for the right one:</P>
      <CodeTabs python={HELLO.python} typescript={HELLO.typescript} />

      <Callout tone="mint">
        Prefer to click than to read? The <Link href="/explorer">Decision Explorer</Link> runs real{" "}
        <Code>check()</Code> calls and shows the Decision, and the <Link href="/compliance">Compliance</Link> page
        renders live control mappings.
      </Callout>
    </DocBody>
  );
}
