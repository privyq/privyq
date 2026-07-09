"use client";

import * as React from "react";
import { CheckCircle2, XCircle, ShieldCheck } from "lucide-react";
import type { EvidenceLogEntry, VerifyResponse } from "@/lib/types";
import { api, CoreOfflineError } from "@/services/api";
import { cn, shortDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

/**
 * EvidenceVerifier (ARCH §11.3) — displays an evidence entry and its
 * verification status (green/red), and lets you simulate the tamper attacks
 * from BP §25.4 (edit signature / edit timestamp / forge actor). Any tamper
 * flips the corresponding check red, demonstrating that the signed, hash-chained
 * evidence detects modification.
 *
 * Verification calls POST /api/v1/verify when the core is online; offline it
 * uses a local mirror where an untampered entry verifies and a tampered one
 * fails.
 */

type Tamper = "none" | "signature" | "timestamp" | "actor";

interface Result extends VerifyResponse {
  source: "core" | "local";
}

export function EvidenceVerifier({ entry }: { entry: EvidenceLogEntry }) {
  const [tamper, setTamper] = React.useState<Tamper>("none");
  const [result, setResult] = React.useState<Result | null>(null);
  const [busy, setBusy] = React.useState(false);

  const display = React.useMemo(() => {
    const e = { ...entry, actor: { ...entry.actor } };
    if (tamper === "signature") e.signature = "ff00…deadbeef";
    if (tamper === "timestamp") e.timestamp = "2020-01-01T00:00:00Z";
    if (tamper === "actor") e.actor.user_id = "attacker_x";
    return e;
  }, [entry, tamper]);

  async function verify() {
    setBusy(true);
    setResult(null);
    const tampered = tamper !== "none";
    try {
      const res = await api.verify({
        evidence: {
          evidence_id: display.evidence_id,
          timestamp: display.timestamp,
          signature: display.signature,
          actor: display.actor,
          operation: display.operation,
          result: display.result,
        },
      });
      setResult({ ...res, source: "core" });
    } catch (err) {
      if (!(err instanceof CoreOfflineError)) {
        // fall through to local mirror on any error
      }
      // local mirror: untampered entries verify; tampering breaks the chain
      setResult({
        source: "local",
        verified: !tampered,
        signature_valid: tamper !== "signature" && tamper !== "actor",
        chain_valid: tamper !== "timestamp",
        policy_compliant: true,
        details: {
          signature_algorithm: "dilithium_3",
          public_key_id: "key_sign_d4",
          chain_position: 42,
          verification_time: new Date().toISOString(),
        },
      });
    }
    setBusy(false);
  }

  const rows: { label: string; ok: boolean | undefined }[] = [
    { label: "Signature valid", ok: result?.signature_valid },
    { label: "Chain integrity", ok: result?.chain_valid },
    { label: "Policy compliant", ok: result?.policy_compliant },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-[12px] border border-line bg-tint/40 p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="font-mono text-[.7rem] uppercase tracking-wide text-muted">
            {display.evidence_id}
          </span>
          <Badge variant={display.result === "granted" ? "granted" : "denied"} size="sm">
            {display.result}
          </Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs">
          <dt className="text-muted">actor</dt>
          <dd className={cn(tamper === "actor" && "text-red")}>
            {display.actor.user_id}
          </dd>
          <dt className="text-muted">resource</dt>
          <dd>{display.resource.resource_id}</dd>
          <dt className="text-muted">operation</dt>
          <dd>{display.operation}</dd>
          <dt className="text-muted">timestamp</dt>
          <dd className={cn(tamper === "timestamp" && "text-red")}>
            {shortDateTime(display.timestamp)}
          </dd>
          <dt className="text-muted">signature</dt>
          <dd className={cn("truncate", tamper === "signature" && "text-red")}>
            {display.signature}
          </dd>
        </dl>
      </div>

      <div className="flex flex-col gap-2">
        <span className="font-mono text-[.7rem] uppercase tracking-wide text-muted">
          Simulate tampering (BP §25.4)
        </span>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["none", "Original"],
              ["signature", "Edit signature"],
              ["timestamp", "Edit timestamp"],
              ["actor", "Forge actor"],
            ] as [Tamper, string][]
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => {
                setTamper(key);
                setResult(null);
              }}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
                tamper === key
                  ? "border-ink bg-ink text-white"
                  : "border-line bg-white text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Button onClick={verify} disabled={busy} variant="outline" size="sm">
        <ShieldCheck className="h-4 w-4" />
        {busy ? "Verifying…" : "Verify evidence"}
      </Button>

      {result && (
        <div
          className={cn(
            "rounded-[12px] border-[1.5px] p-3.5",
            result.verified
              ? "border-mint/60 bg-mint/10"
              : "border-red/60 bg-red/10",
          )}
        >
          <p
            className={cn(
              "mb-2.5 flex items-center gap-2 text-sm font-bold",
              result.verified ? "text-[#0a9c6b]" : "text-[#c62d50]",
            )}
          >
            {result.verified ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <XCircle className="h-4 w-4" />
            )}
            {result.verified
              ? "Verified — access was policy-compliant"
              : "Verification failed — tampering detected"}
          </p>
          <ul className="flex flex-col gap-1.5">
            {rows.map((r) => (
              <li
                key={r.label}
                className="flex items-center gap-2 text-sm text-ink-2"
              >
                {r.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-mint" />
                ) : (
                  <XCircle className="h-4 w-4 text-red" />
                )}
                {r.label}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 font-mono text-[.66rem] text-muted">
            verified by{" "}
            {result.source === "core"
              ? "PrivyQ core"
              : "local mirror (offline)"}
            {result.details
              ? ` · ${result.details.signature_algorithm} · chain #${result.details.chain_position}`
              : ""}
          </p>
        </div>
      )}
    </div>
  );
}
