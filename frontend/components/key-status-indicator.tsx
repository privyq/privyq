import { KeyRound, ShieldCheck, RefreshCw, Ban, Clock } from "lucide-react";
import type { KeyResponse, KeyStatus } from "@/lib/types";
import { cn, shortDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/**
 * KeyStatusIndicator (ARCH §11.3) — shows a key's validity, expiry, algorithm
 * and lifecycle status (active / rotated / revoked / expired — BP §13.2 lifecycle).
 */

const STATUS_META: Record<
  KeyStatus,
  { label: string; variant: "granted" | "blue" | "denied" | "amber"; icon: typeof ShieldCheck }
> = {
  active: { label: "active", variant: "granted", icon: ShieldCheck },
  rotated: { label: "rotated", variant: "blue", icon: RefreshCw },
  revoked: { label: "revoked", variant: "denied", icon: Ban },
  expired: { label: "expired", variant: "amber", icon: Clock },
};

function daysUntil(iso?: string): number | null {
  if (!iso) return null;
  const ms = new Date(iso).getTime() - Date.now();
  if (Number.isNaN(ms)) return null;
  return Math.round(ms / 86_400_000);
}

export function KeyStatusIndicator({
  keyData,
  actions,
}: {
  keyData: KeyResponse;
  actions?: React.ReactNode;
}) {
  const status: KeyStatus = keyData.status ?? "active";
  const meta = STATUS_META[status];
  const Icon = meta.icon;
  const days = daysUntil(keyData.expires_at);
  const usable = status === "active";

  return (
    <div
      className={cn(
        "rounded-[14px] border border-line bg-white p-4 shadow-sm transition-shadow hover:shadow-md",
        !usable && "opacity-90",
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            "grid h-10 w-10 flex-none place-items-center rounded-xl",
            usable ? "bg-ink text-white" : "bg-tint text-muted",
          )}
        >
          <KeyRound className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-mono text-sm font-semibold">
              {keyData.key_id}
            </span>
            <Badge variant={meta.variant} size="sm" className="ml-auto flex-none">
              <Icon className="h-3 w-3" />
              {meta.label}
            </Badge>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <span className="font-mono">{keyData.algorithm}</span>
            <span>·</span>
            <span>{keyData.type}</span>
          </div>
        </div>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 border-t border-line pt-3 text-xs">
        <dt className="text-muted">Created</dt>
        <dd className="text-right font-mono">
          {shortDateTime(keyData.created_at)}
        </dd>
        <dt className="text-muted">Expires</dt>
        <dd
          className={cn(
            "text-right font-mono",
            days !== null && days <= 30 && usable && "text-amber",
          )}
        >
          {keyData.expires_at ? shortDateTime(keyData.expires_at) : "—"}
          {days !== null && usable ? ` (${days}d)` : ""}
        </dd>
      </dl>

      {actions && (
        <div className="mt-3 flex items-center gap-2 border-t border-line pt-3">
          {actions}
        </div>
      )}
    </div>
  );
}
