import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const CONFIGURE = {
  python: `import privyq

privyq.configure(
    core_address="localhost:50051",   # gRPC address of the Go core
    default_algorithm="kyber_768",    # ML-KEM parameter set
    default_signature="dilithium_3",  # ML-DSA parameter set
    audit_enabled=True,               # write audit evidence for every operation
)`,
  typescript: `import { configure } from "@privyq/sdk";

configure({
  gatewayUrl: "http://localhost:8000",  // REST address of the FastAPI gateway
  apiKey: process.env.PRIVYQ_API_KEY,   // sent as the gateway credential
});`,
};

export default function Configuration() {
  return (
    <DocBody>
      <P>
        Configure the SDK once at startup. The Python SDK points at the core over gRPC; the TypeScript SDK points at
        the gateway over REST and passes an API key.
      </P>
      <CodeTabs python={CONFIGURE.python} typescript={CONFIGURE.typescript} />

      <H3>Options</H3>
      <DataTable
        head={["Python", "TypeScript", "Purpose"]}
        rows={[
          [<Code key="a">core_address</Code>, <Code key="b">gatewayUrl</Code>, "Where the SDK sends requests (gRPC core vs REST gateway)."],
          [<Code key="c">default_algorithm</Code>, "algorithm (per-call)", "Default ML-KEM parameter set — kyber_768 (L3), 512, or 1024."],
          [<Code key="d">default_signature</Code>, "algorithm (per-call)", "Default ML-DSA signature parameter set — dilithium_3."],
          [<Code key="e">audit_enabled</Code>, "—", "Whether operations emit signed audit evidence."],
          ["—", <Code key="f">apiKey</Code>, "Gateway credential (API key / token) sent with each request."],
        ]}
      />

      <Callout tone="blue">
        Defaults are <Code>kyber_768</Code> (NIST L3) and <Code>dilithium_3</Code>. The Python SDK also reads{" "}
        <Code>PRIVYQ_CORE_ADDRESS</Code> and related environment variables when you omit the arguments.
      </Callout>
    </DocBody>
  );
}
