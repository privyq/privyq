"use client";

import * as React from "react";
import { ShieldCheck, CheckCircle2, XCircle, CloudOff, RefreshCw } from "lucide-react";
import { api, CoreOfflineError } from "@/services/api";
import type { AuditEntry, VerifyResult } from "@/lib/live";
import { cn, shortDateTime } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function AuditPage() {
  const [entries, setEntries] = React.useState<AuditEntry[]>([]);
  const [chainVerified, setChainVerified] = React.useState<boolean | null>(null);
  const [state, setState] = React.useState<"loading" | "ready" | "offline">("loading");
  const [checks, setChecks] = React.useState<Record<string, VerifyResult>>({});

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const log = await api.evidenceLog({ page_size: 200 });
      setEntries(log.entries);
      setChainVerified(log.verified);
      setState("ready");
    } catch (err) {
      setState(err instanceof CoreOfflineError ? "offline" : "ready");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function verifyOne(entry: AuditEntry) {
    try {
      const res = await api.verify(entry);
      setChecks((prev) => ({ ...prev, [entry.evidence_id]: res }));
    } catch {
      /* ignore */
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Audit"
        title="Evidence log"
        description="Every protect and access decision made by the core, in one hash-chained, signed log. Verify any entry — or the whole chain — cryptographically."
      >
        <Button variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </PageHeading>

      {state === "offline" ? (
        <Card><CardContent className="flex items-center gap-2 py-10 text-amber">
          <CloudOff className="h-5 w-5" /> Core offline — start the stack (make dev) to see the live evidence log.
        </CardContent></Card>
      ) : (
        <>
          <Card className="mb-4">
            <CardContent className="flex flex-wrap items-center gap-4 py-4">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ShieldCheck className={cn("h-5 w-5", chainVerified ? "text-mint" : "text-muted")} />
                {chainVerified === null
                  ? "—"
                  : chainVerified
                    ? `All ${entries.length} entries verified — no tampering detected`
                    : "Chain verification FAILED"}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{entries.length} entries</CardTitle></CardHeader>
            <CardContent>
              {state === "loading" ? (
                <p className="text-muted">Loading…</p>
              ) : entries.length === 0 ? (
                <p className="text-sm text-muted">No evidence yet — protect a record and request access to generate entries.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase tracking-wide text-muted">
                      <tr>
                        <th className="px-2 py-2">When</th>
                        <th className="px-2 py-2">Actor</th>
                        <th className="px-2 py-2">Op</th>
                        <th className="px-2 py-2">Resource</th>
                        <th className="px-2 py-2">Result</th>
                        <th className="px-2 py-2">Verify</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((e) => {
                        const c = checks[e.evidence_id];
                        return (
                          <tr key={e.evidence_id} className="border-t border-line">
                            <td className="whitespace-nowrap px-2 py-2 font-mono text-xs text-muted">{shortDateTime(e.timestamp)}</td>
                            <td className="px-2 py-2">{e.actor?.user_id ?? "—"}</td>
                            <td className="px-2 py-2 font-mono text-xs">{e.operation}</td>
                            <td className="px-2 py-2 font-mono text-xs text-muted">{e.resource_id}</td>
                            <td className="px-2 py-2">
                              <Badge variant={e.result === "granted" ? "granted" : "denied"}>{e.result}</Badge>
                            </td>
                            <td className="px-2 py-2">
                              {c ? (
                                c.verified ? (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-mint"><CheckCircle2 className="h-4 w-4" /> valid</span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-red"><XCircle className="h-4 w-4" /> invalid</span>
                                )
                              ) : (
                                <button className="text-xs font-semibold text-blue hover:underline" onClick={() => verifyOne(e)}>verify</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
