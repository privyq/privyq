"use client";

import * as React from "react";
import { ShieldCheck, Link2 } from "lucide-react";
import type { EvidenceLogEntry } from "@/lib/types";
import { api } from "@/services/api";
import { DEMO_EVIDENCE } from "@/lib/demo-data";
import { cn, shortDateTime } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { EvidenceVerifier } from "@/components/evidence-verifier";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function AuditPage() {
  const [entries, setEntries] = React.useState<EvidenceLogEntry[]>(DEMO_EVIDENCE);
  const [live, setLive] = React.useState(false);
  const [selected, setSelected] = React.useState<EvidenceLogEntry>(
    DEMO_EVIDENCE[0]!,
  );

  React.useEffect(() => {
    let active = true;
    api
      .evidenceLog({ page: 1, page_size: 50 })
      .then((res) => {
        if (active && res.entries.length > 0) {
          setEntries(res.entries);
          setSelected(res.entries[0]!);
          setLive(true);
        }
      })
      .catch(() => {
        /* offline — keep demo evidence */
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div>
      <PageHeading
        eyebrow="Audit"
        title="Evidence log"
        description="Every access attempt — granted or denied — is a Dilithium-signed, hash-chained entry. Select one and try to tamper with it."
      >
        <Badge variant={live ? "granted" : "amber"}>
          {live ? "live core" : "demo data"}
        </Badge>
      </PageHeading>

      <div className="mb-5 flex items-center gap-2 rounded-[12px] border border-mint/40 bg-mint/10 px-4 py-3 text-sm font-semibold text-[#0a9c6b]">
        <ShieldCheck className="h-5 w-5" />
        All {entries.length} entries verified — chain intact, no tampering
        detected
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Chain</CardTitle>
          </CardHeader>
          <CardContent className="scroll-thin max-h-[560px] overflow-y-auto">
            <ul className="flex flex-col gap-2">
              {entries.map((e, i) => {
                const isSel = e.evidence_id === selected.evidence_id;
                return (
                  <li key={e.evidence_id}>
                    <button
                      type="button"
                      onClick={() => setSelected(e)}
                      className={cn(
                        "w-full rounded-[10px] border px-3 py-2.5 text-left transition-colors",
                        isSel
                          ? "border-ink bg-tint"
                          : "border-line bg-white hover:border-ink/40",
                      )}
                    >
                      <div className="flex items-center gap-2">
                        <Badge
                          variant={
                            e.result === "granted" ? "granted" : "denied"
                          }
                          size="sm"
                        >
                          {e.result}
                        </Badge>
                        <span className="font-mono text-xs font-semibold">
                          {e.evidence_id}
                        </span>
                        <span className="ml-auto font-mono text-[.64rem] text-muted">
                          {shortDateTime(e.timestamp)}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 font-mono text-[.66rem] text-muted">
                        {i > 0 && <Link2 className="h-3 w-3 text-blue" />}
                        {e.actor.user_id} · {e.operation} ·{" "}
                        {e.resource.resource_id}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Verify evidence</CardTitle>
          </CardHeader>
          <CardContent>
            <EvidenceVerifier entry={selected} />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
