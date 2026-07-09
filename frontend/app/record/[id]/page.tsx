"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Lock, CheckCircle2, XCircle } from "lucide-react";
import { shortDateTime, cn } from "@/lib/utils";
import { api } from "@/services/api";
import type { AuditEntry } from "@/lib/live";
import { useRecords } from "@/components/providers/records-provider";
import { PageHeading } from "@/components/page-heading";
import { AccessRequestCard } from "@/components/access-request-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RecordDetailPage() {
  const params = useParams<{ id: string }>();
  const { getRecord, hydrated } = useRecords();
  const record = getRecord(params.id);
  const [receipts, setReceipts] = React.useState<AuditEntry[]>([]);
  const [chainOk, setChainOk] = React.useState<boolean | null>(null);

  const loadReceipts = React.useCallback(async () => {
    try {
      const log = await api.evidenceLog({ resource_id: params.id, page_size: 100 });
      setReceipts(log.entries);
      setChainOk(log.verified);
    } catch {
      setReceipts([]);
      setChainOk(null);
    }
  }, [params.id]);

  React.useEffect(() => {
    if (record) loadReceipts();
  }, [record, loadReceipts]);

  if (!hydrated) return <p className="text-muted">Loading…</p>;

  if (!record) {
    return (
      <div>
        <PageHeading title="Record not found" description="It may have been created in another browser, or cleared." />
        <Link href="/records" className="font-semibold text-blue hover:underline">← Back to records</Link>
      </div>
    );
  }

  return (
    <div>
      <Link href="/records" className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
        <ArrowLeft className="h-4 w-4" /> All records
      </Link>

      <PageHeading
        eyebrow={record.id}
        title={<span className="inline-flex items-center gap-2"><Lock className="h-6 w-6" />{record.patientName}</span>}
        description={record.summary}
      >
        <Badge variant="muted">{record.classification}</Badge>
        <Badge variant="blue">{record.algorithm}</Badge>
      </PageHeading>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader><CardTitle>Request access</CardTitle></CardHeader>
          <CardContent>
            <AccessRequestCard record={record} onAttempt={loadReceipts} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Record metadata</CardTitle></CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
                <dt className="text-muted">owner</dt><dd>{record.owner}</dd>
                <dt className="text-muted">key_id</dt><dd className="truncate">{record.keyId}</dd>
                <dt className="text-muted">policy_hash</dt><dd className="truncate">{record.policyHash}</dd>
                <dt className="text-muted">created</dt><dd>{shortDateTime(record.createdAt)}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Access receipts
                {chainOk !== null && (
                  <span className={cn("text-xs font-semibold", chainOk ? "text-mint" : "text-red")}>
                    {chainOk ? "chain verified ✓" : "chain broken ✕"}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {receipts.length === 0 ? (
                <p className="text-sm text-muted">No access attempts yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {[...receipts].reverse().map((r) => (
                    <li key={r.evidence_id} className="flex items-center gap-2 rounded-lg border border-line bg-tint/40 px-2.5 py-2 text-xs">
                      {r.result === "granted" ? (
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-mint" />
                      ) : (
                        <XCircle className="h-4 w-4 shrink-0 text-red" />
                      )}
                      <span className="font-semibold">{r.actor?.user_id ?? "—"}</span>
                      <span className="text-muted">{r.operation}</span>
                      <span className={cn("ml-auto font-mono", r.result === "granted" ? "text-mint" : "text-red")}>
                        {r.result}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
