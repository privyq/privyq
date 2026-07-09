"use client";

import Link from "next/link";
import { Lock, Plus, FileText } from "lucide-react";
import { shortDateTime } from "@/lib/utils";
import { useRecords } from "@/components/providers/records-provider";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function RecordsPage() {
  const { records, hydrated } = useRecords();

  return (
    <div>
      <PageHeading
        eyebrow="Protected records"
        title="Records"
        description="Every record you protect is sealed with post-quantum encryption and its access policy. Open one to try accessing it as different people."
      >
        <Link href="/upload">
          <Button><Plus className="h-4 w-4" /> New record</Button>
        </Link>
      </PageHeading>

      {!hydrated ? (
        <p className="text-muted">Loading…</p>
      ) : records.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
            <FileText className="h-8 w-8 text-muted" />
            <p className="font-semibold">No records yet</p>
            <p className="max-w-sm text-sm text-muted">
              Protect your first patient record from the dashboard or the “New record” page — then switch personas and try to access it.
            </p>
            <Link href="/upload"><Button><Plus className="h-4 w-4" /> Protect a record</Button></Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {records.map((r) => (
            <Link key={r.id} href={`/record/${r.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardContent className="flex flex-col gap-3 py-5">
                  <div className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-blue" />
                    <span className="font-semibold">{r.patientName}</span>
                    {r.patientAge ? <span className="text-sm text-muted">· {r.patientAge}</span> : null}
                  </div>
                  <p className="line-clamp-2 text-sm text-muted">{r.summary}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="muted">{r.classification}</Badge>
                    <Badge variant="blue">{r.algorithm}</Badge>
                  </div>
                  <p className="mt-auto font-mono text-[11px] text-muted">
                    {r.id} · {shortDateTime(r.createdAt)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
