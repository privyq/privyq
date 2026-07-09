"use client";

import { Link2 } from "lucide-react";
import type { Receipt } from "@/components/access-request-card";
import { Badge } from "@/components/ui/badge";

/**
 * Signed, hash-chained access receipts — mirrors the receipt feed from
 * the original design prototype Each entry links back to the previous hash.
 */
export function ReceiptList({ receipts }: { receipts: Receipt[] }) {
  if (receipts.length === 0) {
    return (
      <div className="rounded-[12px] border border-dashed border-line bg-tint/40 p-4 text-sm text-muted">
        No receipts yet — run an access request and each attempt (granted or
        denied) is recorded here.
      </div>
    );
  }

  return (
    <ul className="scroll-thin flex max-h-[420px] flex-col gap-2 overflow-y-auto pr-1">
      {receipts.map((r) => (
        <li
          key={r.id}
          className="animate-slideIn rounded-[12px] border border-line bg-white p-3 shadow-sm"
        >
          <div className="flex items-center gap-2">
            <Badge variant={r.granted ? "granted" : "denied"} size="sm">
              {r.granted ? "granted" : "denied"}
            </Badge>
            <span className="text-sm font-semibold">{r.actor}</span>
            <span className="ml-auto font-mono text-[.66rem] text-muted">
              {r.time}
            </span>
          </div>
          <p className="mt-1.5 flex flex-wrap items-center gap-1.5 break-all font-mono text-[.64rem] text-muted">
            <Link2 className="h-3 w-3 flex-none text-blue" />
            signed · #{r.hash} ← chained to #{r.parent}
          </p>
        </li>
      ))}
    </ul>
  );
}
