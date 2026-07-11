"use client";

import * as React from "react";
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  CloudOff,
  Loader2,
  Download,
  RefreshCw,
  FileJson,
  FileSpreadsheet,
  FileText,
  Link2,
} from "lucide-react";
import type { ComplianceReport, EvidenceExportFormat } from "@/lib/live";
import { api, downloadEvidenceExport, ApiError, CoreOfflineError } from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const FRAMEWORKS = ["GDPR", "HIPAA", "SOC2"] as const;
type Framework = (typeof FRAMEWORKS)[number];

const EXPORTS: { format: EvidenceExportFormat; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { format: "json", label: "JSON", icon: FileJson },
  { format: "csv", label: "CSV", icon: FileSpreadsheet },
  { format: "pdf", label: "PDF", icon: FileText },
];

export default function CompliancePage() {
  const [framework, setFramework] = React.useState<Framework>("GDPR");
  const [report, setReport] = React.useState<ComplianceReport | null>(null);
  const [state, setState] = React.useState<"idle" | "loading" | "ready" | "offline" | "error">("idle");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [exporting, setExporting] = React.useState<EvidenceExportFormat | null>(null);
  const [exportNote, setExportNote] = React.useState<string | null>(null);

  const load = React.useCallback(async (fw: Framework) => {
    setState("loading");
    setErrorMsg("");
    try {
      const r = await api.complianceReport({ framework: fw });
      setReport(r);
      setState("ready");
    } catch (err) {
      if (err instanceof CoreOfflineError) setState("offline");
      else {
        setState("error");
        setErrorMsg(err instanceof ApiError ? err.message : "Failed to load the report.");
      }
    }
  }, []);

  React.useEffect(() => {
    void load(framework);
  }, [framework, load]);

  async function runExport(format: EvidenceExportFormat) {
    setExporting(format);
    setExportNote(null);
    try {
      await downloadEvidenceExport({ format });
      setExportNote(`Downloaded the evidence trail as ${format.toUpperCase()}.`);
    } catch (err) {
      if (err instanceof CoreOfflineError) setExportNote("Core offline — start the stack to export.");
      else setExportNote(err instanceof ApiError ? err.message : "Export failed.");
    } finally {
      setExporting(null);
    }
  }

  const satisfied = report?.controls.filter((c) => c.satisfied).length ?? 0;

  return (
    <div>
      <PageHeading
        eyebrow="Compliance"
        title="Provable governance"
        description="PrivyQ maps the tamper-evident evidence chain onto GDPR, HIPAA, and SOC 2 controls, asserting only what the evidence actually shows. Export the underlying trail for auditors in one click."
      >
        <Button variant="ghost" onClick={() => load(framework)}>
          <RefreshCw className="h-4 w-4" /> Refresh
        </Button>
      </PageHeading>

      {/* Framework selector */}
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <span className="mr-1 font-mono text-xs uppercase tracking-wide text-muted">Framework</span>
        {FRAMEWORKS.map((fw) => (
          <button
            key={fw}
            type="button"
            onClick={() => setFramework(fw)}
            className={cn(
              "rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors",
              fw === framework ? "border-ink bg-ink text-white" : "border-line bg-white text-muted hover:border-ink",
            )}
          >
            {fw}
          </button>
        ))}
      </div>

      {state === "offline" ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-amber">
            <CloudOff className="h-5 w-5" /> Core offline — start the stack to generate a compliance report.
          </CardContent>
        </Card>
      ) : state === "error" ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-red">
            <XCircle className="h-5 w-5" /> {errorMsg}
          </CardContent>
        </Card>
      ) : state === "loading" || state === "idle" || !report ? (
        <Card>
          <CardContent className="flex items-center gap-2 py-10 text-muted">
            <Loader2 className="h-5 w-5 animate-spin" /> Generating {framework} report…
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {/* Summary counts */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile label="Access events" value={report.total_events} />
            <StatTile label="Granted" value={report.granted} tone="mint" />
            <StatTile label="Denied" value={report.denied} tone="red" />
            <StatTile
              label={`Controls satisfied`}
              value={`${satisfied}/${report.controls.length}`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            {/* Controls */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <span className="inline-flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-blue" /> {report.framework} controls
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {report.controls.length === 0 ? (
                  <p className="text-sm text-muted">No controls returned for this framework.</p>
                ) : (
                  <ul className="flex flex-col divide-y divide-line">
                    {report.controls.map((c) => (
                      <li key={c.id} className="flex items-start gap-3 py-3">
                        {c.satisfied ? (
                          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-mint" />
                        ) : (
                          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red" />
                        )}
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-[11px] text-muted">{c.id}</span>
                            <span className="font-semibold text-ink">{c.name}</span>
                            <Badge variant={c.satisfied ? "granted" : "denied"} size="sm">
                              {c.satisfied ? "satisfied" : "not satisfied"}
                            </Badge>
                          </div>
                          <p className="mt-1 text-sm text-muted">{c.basis}</p>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Side: chain status, purposes, export */}
            <div className="flex flex-col gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Evidence chain</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div
                    className={cn(
                      "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold",
                      report.chain_verified
                        ? "border-mint/40 bg-mint/5 text-[#0a9c6b]"
                        : "border-red/40 bg-red/5 text-[#c62d50]",
                    )}
                  >
                    <Link2 className="h-4 w-4" />
                    {report.chain_verified ? "Hash chain verified — untampered" : "Chain verification failed"}
                  </div>
                  {Object.keys(report.by_purpose).length > 0 && (
                    <div>
                      <p className="mb-1.5 font-mono text-[11px] uppercase tracking-wide text-muted">Access by purpose</p>
                      <ul className="flex flex-col gap-1">
                        {Object.entries(report.by_purpose).map(([p, n]) => (
                          <li key={p} className="flex items-center justify-between text-sm">
                            <span className="text-ink-2">{p}</span>
                            <span className="font-mono text-muted">{n}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <p className="font-mono text-[11px] text-muted">generated_at {report.generated_at}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Export evidence</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <p className="text-sm text-muted">
                    Download the signed, hash-chained evidence trail for an auditor.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {EXPORTS.map(({ format, label, icon: Icon }) => (
                      <Button
                        key={format}
                        variant="outline"
                        size="sm"
                        disabled={exporting !== null}
                        onClick={() => runExport(format)}
                      >
                        {exporting === format ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Icon className="h-3.5 w-3.5" />
                        )}
                        {label}
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    ))}
                  </div>
                  {exportNote && <p className="text-xs text-muted">{exportNote}</p>}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: "mint" | "red";
}) {
  return (
    <Card>
      <CardContent className="py-5">
        <p
          className={cn(
            "font-display text-3xl font-extrabold tracking-tight",
            tone === "mint" && "text-[#0a9c6b]",
            tone === "red" && "text-[#c62d50]",
          )}
        >
          {value}
        </p>
        <p className="mt-1 text-sm text-muted">{label}</p>
      </CardContent>
    </Card>
  );
}
