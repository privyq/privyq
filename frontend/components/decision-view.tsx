"use client";

import * as React from "react";
import { CheckCircle2, XCircle, ShieldCheck, ShieldX, ClipboardList } from "lucide-react";
import type { Decision } from "@/lib/live";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Turn an obligation token (`mask:account_no`, `ttl:1h`, `log`) into readable text. */
function obligationLabel(o: string): string {
  const [verb, arg] = o.split(":");
  switch (verb) {
    case "mask":
      return `Mask field “${arg}”`;
    case "redact":
      return `Redact field “${arg}”`;
    case "watermark":
      return "Watermark the output";
    case "require_mfa":
      return "Require MFA";
    case "notify":
      return `Notify ${arg}`;
    case "ttl":
      return `Expire access after ${arg}`;
    case "log":
      return "Write an audit record";
    default:
      return o;
  }
}

/**
 * Renders a PDP `Decision` (blueprint §6.2): the allowed/denied verdict, the
 * human `reason`, the conditions that matched vs failed, and — on a grant — the
 * obligations the enforcement point must honour ("yes, but…", §6.4).
 */
export function DecisionView({ decision }: { decision: Decision }) {
  const { allowed, reason, matched, failed, obligations } = decision;
  return (
    <div className="flex flex-col gap-4">
      <div
        className={cn(
          "flex items-start gap-3 rounded-xl border p-4",
          allowed ? "border-mint/50 bg-mint/5 animate-pop" : "border-red/40 bg-red/5 animate-pop",
        )}
      >
        {allowed ? (
          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-mint" />
        ) : (
          <ShieldX className="mt-0.5 h-5 w-5 shrink-0 text-red" />
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {allowed ? (
              <Badge variant="granted">
                <CheckCircle2 className="h-3.5 w-3.5" /> allowed
              </Badge>
            ) : (
              <Badge variant="denied">
                <XCircle className="h-3.5 w-3.5" /> denied
              </Badge>
            )}
            {decision.policy_id && (
              <span className="font-mono text-[11px] text-muted">{decision.policy_id}</span>
            )}
          </div>
          <p className="mt-2 text-sm text-ink-2">{reason || "No reason returned by the engine."}</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ConditionColumn title="Matched" tone="mint" items={matched} />
        <ConditionColumn title="Failed" tone="red" items={failed} />
      </div>

      {allowed && obligations.length > 0 && (
        <div className="rounded-xl border border-blue/30 bg-blue/[.05] p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-bold text-ink">
            <ClipboardList className="h-4 w-4 text-blue" /> Obligations — “yes, but…”
          </p>
          <ul className="flex flex-col gap-1.5">
            {obligations.map((o) => (
              <li key={o} className="flex items-center gap-2 text-sm text-ink-2">
                <span className="rounded bg-blue/10 px-1.5 py-0.5 font-mono text-[11px] text-blue">{o}</span>
                <span className="text-muted">{obligationLabel(o)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            PrivyQ returns these; the enforcement point (your code, or the gateway) must honour them.
          </p>
        </div>
      )}

      {decision.evaluated_at && (
        <p className="font-mono text-[11px] text-muted">evaluated_at {decision.evaluated_at}</p>
      )}
    </div>
  );
}

function ConditionColumn({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "mint" | "red";
  items: string[];
}) {
  const Icon = tone === "mint" ? CheckCircle2 : XCircle;
  return (
    <div className="rounded-xl border border-line bg-white p-3">
      <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-wide text-muted">
        {title} · {items.length}
      </p>
      {items.length === 0 ? (
        <p className="text-xs text-muted">—</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((c) => (
            <li
              key={c}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 font-mono text-[11px]",
                tone === "mint" ? "border-mint/40 bg-mint/5" : "border-red/40 bg-red/5",
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", tone === "mint" ? "text-mint" : "text-red")} />
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
