"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Lock, ArrowRight } from "lucide-react";
import { DEMO_RECORDS } from "@/lib/demo-data";
import { shortDateTime } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

export default function RecordsPage() {
  const [query, setQuery] = React.useState("");

  const filtered = DEMO_RECORDS.filter((r) => {
    const q = query.toLowerCase();
    return (
      r.patientName.toLowerCase().includes(q) ||
      r.id.toLowerCase().includes(q) ||
      r.summary.toLowerCase().includes(q) ||
      r.classification.toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <PageHeading
        eyebrow="Records"
        title="Protected records"
        description="Every record is encrypted with an embedded policy. Open one to request access as the current persona."
      />

      <div className="relative mb-5 max-w-md">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          className="pl-10"
          placeholder="Search by patient, id, or classification…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search records"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((r) => (
          <Link key={r.id} href={`/record/${r.id}`}>
            <Card className="h-full transition-transform hover:-translate-y-1 hover:shadow-md">
              <CardContent className="flex h-full flex-col gap-3 p-5">
                <div className="flex items-center gap-2">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-ink text-white">
                    <Lock className="h-4 w-4" />
                  </span>
                  <div>
                    <div className="font-semibold">{r.patientName}</div>
                    <div className="font-mono text-xs text-muted">{r.id}</div>
                  </div>
                  <Badge variant="muted" size="sm" className="ml-auto">
                    {r.classification}
                  </Badge>
                </div>
                <p className="text-sm text-muted">{r.summary}</p>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  <Badge variant="blue" size="sm">
                    {r.algorithm}
                  </Badge>
                  <Badge variant="neutral" size="sm">
                    {r.policy.conditions.length} conditions
                  </Badge>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3 text-xs text-muted">
                  <span className="font-mono">
                    {shortDateTime(r.createdAt)}
                  </span>
                  <span className="inline-flex items-center gap-1 font-semibold text-blue">
                    Request access <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted">No records match “{query}”.</p>
        )}
      </div>
    </div>
  );
}
