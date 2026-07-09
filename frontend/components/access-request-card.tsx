"use client";

import * as React from "react";
import { Lock, LockOpen, ShieldX, Loader2, CloudOff } from "lucide-react";
import { api, ApiError, CoreOfflineError } from "@/services/api";
import { fromBase64, cn } from "@/lib/utils";
import { useIdentity } from "@/components/providers/identity-provider";
import type { StoredRecord } from "@/components/providers/records-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * AccessRequestCard — shows a record's policy and the acting persona, then makes
 * a REAL POST /api/v1/access with the record's protected envelope. A 200 grants
 * (the plaintext is revealed); a 403 denies (the core's reason is shown). Every
 * attempt is recorded by the core, so the parent refreshes the receipt list.
 */

type Outcome =
  | { kind: "idle" }
  | { kind: "busy" }
  | { kind: "granted"; text: string }
  | { kind: "denied"; reason: string }
  | { kind: "offline" }
  | { kind: "error"; message: string };

const CIPHER = "▓▓▓▓ ▓▓▓▓▓ ▓▓ ▓▓▓▓▓▓▓ ▓▓▓\n▓▓▓▓▓ ▓▓ ▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓▓\n▓▓ ▓▓▓▓▓▓▓ ▓▓▓▓ ▓▓▓ ▓▓▓▓▓";

export function AccessRequestCard({
  record,
  onAttempt,
}: {
  record: StoredRecord;
  onAttempt?: () => void;
}) {
  const { persona } = useIdentity();
  const [outcome, setOutcome] = React.useState<Outcome>({ kind: "idle" });

  // Reset the panel when the persona changes so a prior grant isn't left on screen.
  React.useEffect(() => setOutcome({ kind: "idle" }), [persona.id]);

  async function requestAccess() {
    setOutcome({ kind: "busy" });
    try {
      const res = await api.access({
        protected_data: record.protectedData,
        identity: persona.identity,
        context: { timestamp: new Date().toISOString() },
      });
      setOutcome({ kind: "granted", text: fromBase64(res.data) });
    } catch (err) {
      if (err instanceof CoreOfflineError) setOutcome({ kind: "offline" });
      else if (err instanceof ApiError && err.status === 403)
        setOutcome({ kind: "denied", reason: err.message });
      else if (err instanceof ApiError)
        setOutcome({ kind: "error", message: `${err.status}: ${err.message}` });
      else setOutcome({ kind: "error", message: "Unexpected error." });
    } finally {
      onAttempt?.();
    }
  }

  const open = outcome.kind === "granted";
  const denied = outcome.kind === "denied";

  return (
    <div className="flex flex-col gap-4">
      {/* who is asking */}
      <div className="flex items-center justify-between gap-3 rounded-[12px] border border-line bg-tint/50 px-3 py-2.5">
        <div>
          <p className="text-sm font-semibold">{persona.name}</p>
          <p className="font-mono text-xs text-muted">
            {persona.identity.role} · {persona.identity.department} · {persona.identity.purpose}
          </p>
        </div>
        <Button onClick={requestAccess} disabled={outcome.kind === "busy"}>
          {outcome.kind === "busy" ? <Loader2 className="h-4 w-4 animate-spin" /> : <LockOpen className="h-4 w-4" />}
          Request access
        </Button>
      </div>

      {/* policy being enforced */}
      <div>
        <p className="mb-1.5 font-mono text-xs uppercase tracking-wide text-muted">
          Policy ({record.policy.combination})
        </p>
        <div className="flex flex-wrap gap-1.5">
          {record.policy.conditions.map((c, i) => (
            <Badge key={i} variant="muted">
              {c.type} {c.operator.replace("_", " ")} {Array.isArray(c.value) ? c.value.join("/") : c.value}
            </Badge>
          ))}
        </div>
      </div>

      {/* the vault */}
      <div
        className={cn(
          "rounded-[14px] border p-4 transition-colors",
          open ? "border-mint/50 bg-mint/5" : denied ? "border-red/40 bg-red/5" : "border-line bg-ink/[0.03]",
        )}
      >
        <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
          {open ? (
            <><LockOpen className="h-4 w-4 text-mint" /> UNLOCKED</>
          ) : denied ? (
            <><ShieldX className="h-4 w-4 text-red" /> DENIED</>
          ) : (
            <><Lock className="h-4 w-4" /> LOCKED</>
          )}
        </div>

        {outcome.kind === "granted" && (
          <pre className="whitespace-pre-wrap font-mono text-xs text-ink">{outcome.text}</pre>
        )}
        {outcome.kind === "denied" && (
          <p className="text-sm text-red">{outcome.reason} — the data stays sealed.</p>
        )}
        {outcome.kind === "offline" && (
          <p className="flex items-center gap-2 text-sm text-amber">
            <CloudOff className="h-4 w-4" /> Core offline — start the stack to request access.
          </p>
        )}
        {outcome.kind === "error" && <p className="text-sm text-red">{outcome.message}</p>}
        {(outcome.kind === "idle" || outcome.kind === "busy") && (
          <pre className="whitespace-pre-wrap font-mono text-xs text-muted">{CIPHER}</pre>
        )}
      </div>
    </div>
  );
}
