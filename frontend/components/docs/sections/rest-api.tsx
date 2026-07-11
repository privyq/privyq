import { CodeTabs } from "@/components/docs/code-tabs";
import { CodeBlock, Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";
import { Badge } from "@/components/ui/badge";

const ENDPOINTS: [string, string, string][] = [
  ["POST", "/api/v1/protect", "Encrypt data with an embedded policy."],
  ["POST", "/api/v1/access", "Authorize + reveal when the identity satisfies the policy."],
  ["POST", "/api/v1/check", "The PDP decision — a Decision, no data revealed."],
  ["POST", "/api/v1/explain", "Human-readable reason for a decision."],
  ["POST", "/api/v1/seal", "Post-quantum signature over data."],
  ["POST", "/api/v1/verify", "Verify a receipt's signature and chain, or a seal."],
  ["GET", "/api/v1/evidence/log", "Query the tamper-evident audit chain."],
  ["GET", "/api/v1/evidence/export", "Export the evidence trail as json / csv / pdf."],
  ["GET", "/api/v1/compliance/report", "Map the evidence onto GDPR / HIPAA / SOC2 controls."],
  ["GET", "/api/v1/keys", "List managed keys."],
  ["GET", "/api/v1/keys/{id}", "Get public key info by id."],
  ["POST", "/api/v1/keys/generate", "Mint a new post-quantum key pair."],
  ["POST", "/api/v1/keys/rotate/{id}", "Rotate a key (successor minted, old retained)."],
  ["POST", "/api/v1/keys/revoke/{id}", "Revoke a key and cut off access."],
  ["GET", "/api/v1/health", "Liveness probe for the gateway and core."],
];

const CURL = `curl -s http://localhost:8000/api/v1/check \\
  -H 'content-type: application/json' \\
  -H 'x-api-key: $PRIVYQ_API_KEY' \\
  -d '{
    "identity": {"role": "reviewer", "approval_limit": 5000000},
    "policy": {"combination": "custom",
               "custom_logic": "role == \\"manager\\" and amount <= approval_limit"},
    "purpose": "approval"
  }'
# -> { "allowed": false, "reason": "…", "matched": [...], "failed": [...], "obligations": [] }`;

const REQUEST = {
  python: `import requests

r = requests.post(
    "http://localhost:8000/api/v1/check",
    headers={"x-api-key": API_KEY},
    json={
        "identity": {"role": "reviewer", "approval_limit": 5_000_000},
        "policy": {"combination": "custom",
                   "custom_logic": 'role == "manager" and amount <= approval_limit'},
        "purpose": "approval",
    },
)
decision = r.json()   # {allowed, reason, matched, failed, obligations, policy_id}`,
  typescript: `const r = await fetch("http://localhost:8000/api/v1/check", {
  method: "POST",
  headers: { "content-type": "application/json", "x-api-key": apiKey },
  body: JSON.stringify({
    identity: { role: "reviewer", approval_limit: 5_000_000 },
    policy: {
      combination: "custom",
      custom_logic: 'role == "manager" and amount <= approval_limit',
    },
    purpose: "approval",
  }),
});
const decision = await r.json(); // {allowed, reason, matched, failed, obligations, policy_id}`,
};

export default function RestApi() {
  return (
    <DocBody>
      <P>
        The FastAPI gateway exposes the whole surface over REST — it is the client↔gateway contract and the{" "}
        Policy-Decision-as-a-Service endpoint any service can call. The base URL defaults to{" "}
        <Code>http://localhost:8000</Code>; payload data is base64-encoded; requests carry an{" "}
        <Code>x-api-key</Code> (or bearer token).
      </P>

      <H3>Endpoints</H3>
      <DataTable
        head={["Method", "Endpoint", "Description"]}
        rows={ENDPOINTS.map(([m, p, d]) => [
          <Badge key="m" variant={m === "GET" ? "muted" : "blue"} size="sm">{m}</Badge>,
          <code key="p" className="font-mono text-[.8rem] text-ink-2">{p}</code>,
          <span key="d">{d}</span>,
        ])}
      />

      <H3>Call it directly</H3>
      <P>A raw <Code>check</Code> with curl:</P>
      <CodeBlock lang="bash" code={CURL} />
      <P>Or from your language of choice:</P>
      <CodeTabs python={REQUEST.python} typescript={REQUEST.typescript} />

      <Callout tone="blue">
        When the gateway is running, the full interactive OpenAPI reference is served at{" "}
        <a href="http://localhost:8000/docs" target="_blank" rel="noopener">localhost:8000/docs</a>, and the machine
        spec lives at <Code>docs/api/openapi.json</Code> — from which the frontend&apos;s typed client is generated.
      </Callout>
    </DocBody>
  );
}
