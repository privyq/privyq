import Link from "next/link";
import { CodeTabs } from "@/components/docs/code-tabs";
import { Code } from "@/components/doc-code";
import { DocBody, P, H3, Callout, DataTable } from "@/components/docs/prose";

const REPORT = {
  python: `# Build a report from the evidence chain (via evidence.export bytes):
report_pdf = evidence.export("pdf", resource_id="rec_123")

# Framework-mapped reports are served by the gateway; from Python you typically
# export the underlying evidence and attach the control mapping from the report.
csv = evidence.export("csv", actor_id="dr_smith",
                      start_time="2026-01-01T00:00:00Z")`,
  typescript: `// A framework control mapping straight from the evidence:
const gdpr = await evidence.complianceReport({ framework: "GDPR" });
gdpr.controls;        // [{ id, name, satisfied, basis }, …]
gdpr.granted;         // counts
gdpr.chainVerified;   // the trail verifies

// …and the underlying trail in any format:
const pdf = await evidence.export("pdf", { resourceId: "rec_123" });`,
};

export default function Compliance() {
  return (
    <DocBody>
      <P>
        Compliance is where provable governance pays off. PrivyQ maps the tamper-evident evidence chain onto control
        frameworks, asserting only what the evidence actually shows — that decisions were policy-governed, that the
        trail verifies, that purposes were recorded, that unauthorized attempts were denied.
      </P>

      <H3>Frameworks</H3>
      <DataTable
        head={["Framework", "What PrivyQ maps"]}
        rows={[
          ["GDPR", "Purpose limitation, data-subject access, erasure records."],
          ["HIPAA", "Minimum-necessary access and audit controls."],
          ["SOC 2", "Access control and monitoring."],
        ]}
      />

      <H3>Generate a report &amp; export</H3>
      <P>
        The TypeScript SDK exposes a framework control mapping directly; both SDKs export the underlying evidence in{" "}
        <Code>json</Code>, <Code>csv</Code>, or <Code>pdf</Code>.
      </P>
      <CodeTabs python={REPORT.python} typescript={REPORT.typescript} />

      <DataTable
        head={["Format", "Use"]}
        rows={[
          [<Code key="a">json</Code>, "Machine-readable; feed to your own tooling."],
          [<Code key="b">csv</Code>, "Spreadsheets and data-subject request tables."],
          [<Code key="c">pdf</Code>, "A signed, verifiable report for an auditor."],
        ]}
      />

      <Callout tone="mint">
        See it rendered live — controls, counts, chain status, and one-click JSON/CSV/PDF export — on the{" "}
        <Link href="/compliance">Compliance dashboard</Link>.
      </Callout>
    </DocBody>
  );
}
