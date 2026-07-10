"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, ShieldCheck, KeyRound, FlaskConical, ArrowRight } from "lucide-react";
import { shortDateTime } from "@/lib/utils";
import { useRecords } from "@/components/providers/records-provider";
import { useIdentity } from "@/components/providers/identity-provider";
import { RecordForm } from "@/components/record-form";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const { records, hydrated } = useRecords();
  const { persona } = useIdentity();
  const recent = records.slice(0, 5);

  return (
    <div>
      <PageHeading
        eyebrow={`Signed in as ${persona.name}`}
        title="Secure a patient record"
        description="Protect a record below — it's encrypted with post-quantum cryptography and its access policy is sealed inside the ciphertext. Then switch personas (top right) and try to access it from the Records page."
      />

      <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" /> New protected record</CardTitle></CardHeader>
          <CardContent className="py-5"><RecordForm /></CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Recent records
                <Link href="/records" className="text-xs font-semibold text-blue hover:underline">view all</Link>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!hydrated ? (
                <p className="text-muted">Loading…</p>
              ) : recent.length === 0 ? (
                <p className="text-sm text-muted">No records yet. Protect one on the left to get started.</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {recent.map((r) => (
                    <li key={r.id}>
                      <Link href={`/record/${r.id}`} className="flex items-center gap-3 py-2.5 hover:opacity-80">
                        <Lock className="h-4 w-4 text-blue" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{r.patientName}</p>
                          <p className="truncate text-xs text-muted">{r.summary}</p>
                        </div>
                        <Badge variant="muted" className="ml-auto">{r.classification}</Badge>
                        <ArrowRight className="h-4 w-4 text-muted" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-3 gap-3">
            <QuickLink href="/audit" icon={<ShieldCheck className="h-5 w-5" />} label="Audit" />
            <QuickLink href="/keys" icon={<KeyRound className="h-5 w-5" />} label="Keys" />
            <QuickLink href="/playground" icon={<FlaskConical className="h-5 w-5" />} label="Playground" />
          </div>
        </div>
      </div>
    </div>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href}>
      <Card className="h-full transition-shadow hover:shadow-md">
        <CardContent className="flex flex-col items-center gap-1.5 py-4 text-center">
          <span className="text-blue">{icon}</span>
          <span className="text-sm font-semibold">{label}</span>
        </CardContent>
      </Card>
    </Link>
  );
}
