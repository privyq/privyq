import Link from "next/link";
import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const LOG = {
  python: `# Every receipt for one resource:
receipts = evidence.log(resource_id="rec_123")

# Filter by actor and time, with paging:
receipts = evidence.log(
    actor_id="dr_smith",
    start_time="2026-01-01T00:00:00Z",
    end_time="2026-12-31T23:59:59Z",
    page=1, page_size=20,
)
for r in receipts:
    print(r.timestamp, r.result, r.evidence_id)`,
  typescript: `// The trail for one resource:
const trail = await evidence.of("rec_123");

// Or query with filters:
const receipts = await evidence.log({
  actorId: "dr_smith",
  startTime: "2026-01-01T00:00:00Z",
  endTime: "2026-12-31T23:59:59Z",
  page: 1,
  pageSize: 20,
});
for (const r of receipts) console.log(r.timestamp, r.result, r.evidenceId);`,
};

const VERIFY_CHAIN = {
  python: `res = evidence.verify()   # verify the whole chain
assert res.ok and res.chain_valid`,
  typescript: `const res = await evidence.verify(); // verify the whole chain
if (!res.ok || !res.chainValid) throw new Error(res.detail);`,
};

const EXPORT = {
  python: `# Bytes you can write to a file or stream to an auditor:
data = evidence.export("pdf", resource_id="rec_123")
open("audit-rec_123.pdf", "wb").write(data)

csv = evidence.export("csv", actor_id="dr_smith")
js  = evidence.export("json")   # the default`,
  typescript: `// A Blob/bytes you can download or attach:
const pdf = await evidence.export("pdf", { resourceId: "rec_123" });
const csv = await evidence.export("csv", { actorId: "dr_smith" });
const json = await evidence.export("json"); // the default`,
};

export default function Evidence() {
  return (
    <DocBody>
      <P>
        Every operation — <Code>protect</Code>, <Code>access</Code> (granted or denied), <Code>check</Code>,{" "}
        <Code>seal</Code>, and key-lifecycle events — writes a signed, hash-chained evidence entry. Tampering with,
        deleting, or reordering an entry breaks verification.
      </P>

      <H3>Query the trail</H3>
      <CodeTabs python={LOG.python} typescript={LOG.typescript} />
      <DataTable
        head={["Operation", "Python", "TypeScript"]}
        rows={[
          ["Trail for a resource", <Code key="a">evidence.log(resource_id=…)</Code>, <Code key="b">evidence.of(id)</Code>],
          ["Filtered query", <Code key="c">evidence.log(actor_id=…, page=…)</Code>, <Code key="d">evidence.log(filters)</Code>],
          ["Verify the chain", <Code key="e">evidence.verify()</Code>, <Code key="f">evidence.verify()</Code>],
          ["Export", <Code key="g">evidence.export(fmt, …)</Code>, <Code key="h">evidence.export(format, filters)</Code>],
        ]}
      />

      <H3>Verify the whole chain</H3>
      <CodeTabs python={VERIFY_CHAIN.python} typescript={VERIFY_CHAIN.typescript} />

      <H3>Export for compliance</H3>
      <P>
        Export the trail as <Code>json</Code>, <Code>csv</Code>, or <Code>pdf</Code>. The PDF renders a signed,
        verifiable report suitable for an auditor.
      </P>
      <CodeTabs python={EXPORT.python} typescript={EXPORT.typescript} />

      <Callout tone="mint">
        The <Link href="/compliance">Compliance page</Link> wires these exports to one-click downloads, alongside the
        framework control mapping.
      </Callout>
    </DocBody>
  );
}
