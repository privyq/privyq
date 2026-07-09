"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { getDemoRecord } from "@/lib/demo-data";
import { shortDateTime } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import {
  AccessRequestCard,
  type Receipt,
} from "@/components/access-request-card";
import { ReceiptList } from "@/components/receipt-list";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function RecordDetailPage() {
  const params = useParams<{ id: string }>();
  const record = getDemoRecord(params.id);
  const [receipts, setReceipts] = React.useState<Receipt[]>([]);

  const addReceipt = React.useCallback((r: Receipt) => {
    setReceipts((prev) => [r, ...prev]);
  }, []);

  if (!record) {
    return (
      <div>
        <PageHeading title="Record not found" />
        <Link href="/records" className="font-semibold text-blue hover:underline">
          ← Back to records
        </Link>
      </div>
    );
  }

  return (
    <div>
      <Link
        href="/records"
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
      >
        <ArrowLeft className="h-4 w-4" /> All records
      </Link>

      <PageHeading
        eyebrow={record.id}
        title={
          <span className="inline-flex items-center gap-2">
            <Lock className="h-6 w-6" />
            {record.patientName}
          </span>
        }
        description={record.summary}
      >
        <Badge variant="muted">{record.classification}</Badge>
        <Badge variant="blue">{record.algorithm}</Badge>
      </PageHeading>

      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Request access</CardTitle>
          </CardHeader>
          <CardContent>
            <AccessRequestCard record={record} onReceipt={addReceipt} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Record metadata</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
                <dt className="text-muted">owner</dt>
                <dd>{record.owner}</dd>
                <dt className="text-muted">key_id</dt>
                <dd>{record.keyId}</dd>
                <dt className="text-muted">policy_hash</dt>
                <dd className="truncate">{record.policyHash}</dd>
                <dt className="text-muted">created</dt>
                <dd>{shortDateTime(record.createdAt)}</dd>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Access receipts</CardTitle>
            </CardHeader>
            <CardContent>
              <ReceiptList receipts={receipts} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
