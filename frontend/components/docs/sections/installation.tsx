import { CodeTabs } from "@/components/docs/code-tabs";
import { CodeBlock, Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const INSTALL = {
  python: `pip install privyq`,
  typescript: `npm install @privyq/sdk
# or: pnpm add @privyq/sdk  ·  yarn add @privyq/sdk`,
};

const RUN_STACK = `make dev        # docker-compose: core + gateway + frontend + postgres
# core (gRPC):  localhost:50051
# gateway:      http://localhost:8000/docs
make down       # stop the stack`;

export default function Installation() {
  return (
    <DocBody>
      <P>
        Install the SDK for your language. Each SDK is a thin, fully-typed client that carries the whole verb
        vocabulary; it performs no cryptography itself — it talks to the PrivyQ core.
      </P>
      <CodeTabs python={INSTALL.python} typescript={INSTALL.typescript} />

      <H3>Transports</H3>
      <P>
        The <strong>Python</strong> SDK talks to the Go core directly over gRPC (default{" "}
        <Code>localhost:50051</Code>). The <strong>TypeScript</strong> SDK talks to the FastAPI gateway over REST
        (default <Code>http://localhost:8000</Code>), which makes it browser-safe. Either way, the crypto and policy
        evaluation happen only in the core.
      </P>

      <H3>Prerequisites</H3>
      <DataTable
        head={["You need", "For", "Notes"]}
        rows={[
          [<Code key="a">privyqd</Code>, "The Go core", "The only component that touches keys, plaintext, or policy."],
          [<Code key="b">gateway</Code>, "The TS SDK / REST", "FastAPI facade over the core; also the Policy-Decision-as-a-Service endpoint."],
          [<Code key="c">PostgreSQL</Code>, "Persistence", "Keys, policies, resources, and the evidence chain. Optional for the in-memory/local dev path."],
        ]}
      />

      <H3>Run a core &amp; gateway locally</H3>
      <P>The quickest way to bring everything up is Docker Compose:</P>
      <CodeBlock lang="bash" code={RUN_STACK} />

      <Callout tone="amber">
        The SDK needs a running core (Python) or gateway (TypeScript). Start the stack with <Code>make dev</Code>,
        then configure the SDK to point at it — see the next page.
      </Callout>
    </DocBody>
  );
}
