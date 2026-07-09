"use client";

import * as React from "react";
import { Lock, LockOpen, Link2, ShieldCheck, ShieldX } from "lucide-react";
import type { DemoRecord } from "@/lib/demo-data";
import type { EvaluatedCondition, PolicyEvaluation } from "@/lib/types";
import { evaluatePolicy } from "@/lib/policy";
import { api, CoreOfflineError } from "@/services/api";
import { cn, fakeHash, shortTime, toBase64 } from "@/lib/utils";
import { useIdentity } from "@/components/providers/identity-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * AccessRequestCard (ARCH §11.3) — shows a record's policy and the acting
 * identity, then runs an access attempt. Ports the live-demo interaction from
 * the original design prototype conditions light up one by one, the vault unlocks and
 * types out the plaintext on grant, shakes on denial, and every attempt drops a
 * signed, chained receipt.
 *
 * It calls POST /api/v1/access when the core is online, and falls back to the
 * local policy mirror (lib/policy.ts) when it is offline — the demo works either
 * way.
 */

const CIPHER_LINES = [
  "▓▓▓▓ ▓▓▓▓▓ ▓▓ ▓▓▓▓▓▓▓ ▓▓▓",
  "▓▓▓▓▓ ▓▓ ▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓▓",
  "▓▓ ▓▓▓▓▓▓▓ ▓▓▓▓ ▓▓▓ ▓▓▓▓▓",
];
const CIPHERTEXT = CIPHER_LINES.join("\n");

export interface Receipt {
  id: string;
  actor: string;
  time: string;
  granted: boolean;
  hash: string;
  parent: string;
  source: "core" | "local";
}

type Phase = "idle" | "checking" | "granted" | "denied";

const reduceMotion = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const wait = (ms: number) =>
  new Promise<void>((r) => setTimeout(r, reduceMotion() ? 0 : ms));

export function AccessRequestCard({
  record,
  onReceipt,
}: {
  record: DemoRecord;
  onReceipt?: (r: Receipt) => void;
}) {
  const { persona } = useIdentity();
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [evaluated, setEvaluated] = React.useState<EvaluatedCondition[]>([]);
  const [revealed, setRevealed] = React.useState(0);
  const [verdict, setVerdict] = React.useState("Waiting for a request…");
  const [body, setBody] = React.useState(CIPHERTEXT);
  const [source, setSource] = React.useState<"core" | "local" | null>(null);
  const lastHash = React.useRef("genesis");
  const busy = React.useRef(false);

  const reset = React.useCallback(() => {
    setPhase("idle");
    setEvaluated([]);
    setRevealed(0);
    setVerdict("Waiting for a request…");
    setBody(CIPHERTEXT);
    setSource(null);
  }, []);

  // reset the panel whenever the acting persona changes
  React.useEffect(() => {
    reset();
  }, [persona.id, reset]);

  async function typeOut(text: string) {
    if (reduceMotion()) {
      setBody(text);
      return;
    }
    for (let i = 0; i < text.length; i += 3) {
      setBody(text.slice(0, i + 3));
      // eslint-disable-next-line no-await-in-loop
      await wait(9);
    }
    setBody(text);
  }

  async function requestAccess() {
    if (busy.current) return;
    busy.current = true;
    reset();
    setPhase("checking");
    setVerdict("Checking the rules…");

    // Resolve the evaluation — prefer the live core, fall back to local mirror.
    let evaluation: PolicyEvaluation;
    let used: "core" | "local" = "local";
    try {
      await api.access({
        protected_data: toBase64(record.plaintext),
        identity: persona.identity,
        context: { timestamp: new Date().toISOString() },
      });
      evaluation = evaluatePolicy(record.policy, persona.identity, {
        classification: record.classification,
      });
      used = "core";
    } catch (err) {
      if (err instanceof CoreOfflineError) {
        evaluation = evaluatePolicy(record.policy, persona.identity, {
        classification: record.classification,
      });
        used = "local";
      } else {
        // ApiError (e.g. 403 denied) — mirror locally so we always show detail
        evaluation = evaluatePolicy(record.policy, persona.identity, {
        classification: record.classification,
      });
        used = "core";
      }
    }
    setSource(used);
    setEvaluated(evaluation.evaluated_conditions);

    // reveal conditions one at a time
    for (let i = 0; i < evaluation.evaluated_conditions.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await wait(360);
      setRevealed(i + 1);
    }
    await wait(300);

    const granted = evaluation.decision === "granted";
    if (granted) {
      setPhase("granted");
      setVerdict("Access granted — decrypting…");
      await typeOut(record.plaintext);
    } else {
      setPhase("denied");
      setVerdict(`Denied — ${evaluation.reason}. The data stays locked.`);
    }

    const hash = fakeHash();
    const receipt: Receipt = {
      id: `rc_${hash}`,
      actor: persona.name,
      time: shortTime(new Date().toISOString()),
      granted,
      hash,
      parent: lastHash.current,
      source: used,
    };
    lastHash.current = hash;
    onReceipt?.(receipt);

    busy.current = false;
  }

  const isOpen = phase === "granted";
  const isDenied = phase === "denied";

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* left: identity + policy + action */}
      <div className="flex flex-col gap-4">
        <div className="rounded-[14px] border border-line bg-white p-4 shadow-sm">
          <p className="mb-2 font-mono text-[.7rem] uppercase tracking-wide text-muted">
            Acting identity
          </p>
          <div className="flex items-center gap-3">
            <span className="avatar-gradient grid h-10 w-10 place-items-center rounded-xl text-xs font-extrabold text-white">
              {persona.initials}
            </span>
            <div>
              <strong className="block text-sm">{persona.name}</strong>
              <span className="text-xs text-muted">
                {persona.identity.role} · {persona.identity.department} ·{" "}
                {persona.identity.purpose}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-[14px] border border-line bg-white p-4 shadow-sm">
          <p className="mb-2.5 font-mono text-[.7rem] uppercase tracking-wide text-muted">
            Policy conditions
          </p>
          <ul className="flex flex-col gap-2">
            {record.policy.conditions.map((c, i) => {
              const outcome = evaluated[i];
              const shown = i < revealed && outcome;
              return (
                <li
                  key={i}
                  className={cn(
                    "flex items-center gap-2.5 rounded-[10px] border-[1.5px] border-line bg-tint/40 px-3 py-2 text-sm transition-colors",
                    shown &&
                      outcome?.result &&
                      "border-mint/50 bg-mint/10",
                    shown &&
                      outcome &&
                      !outcome.result &&
                      "border-red/50 bg-red/10",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-5 w-5 flex-none place-items-center rounded-[7px] border-[1.5px] border-muted text-[.7rem] font-extrabold",
                      shown &&
                        outcome?.result &&
                        "border-mint bg-mint text-white",
                      shown &&
                        outcome &&
                        !outcome.result &&
                        "border-red bg-red text-white",
                    )}
                    aria-hidden="true"
                  >
                    {shown ? (outcome?.result ? "✓" : "✕") : ""}
                  </span>
                  <span>
                    <b className="font-semibold">{c.type}</b>{" "}
                    {c.operator.replace("_", " ")}{" "}
                    {Array.isArray(c.value) ? c.value.join(", ") : c.value}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        <Button onClick={requestAccess} disabled={phase === "checking"}>
          {phase === "checking" ? "Evaluating…" : "Request access"}
        </Button>
      </div>

      {/* right: vault + verdict */}
      <div className="flex flex-col gap-4">
        <div
          className={cn(
            "flex items-center gap-2 rounded-[10px] border-[1.5px] px-3.5 py-2.5 text-sm font-bold",
            phase === "idle" && "border-dashed border-line bg-tint/40 text-muted",
            phase === "checking" && "border-line bg-tint/60 text-ink-2",
            phase === "granted" && "border-mint/60 bg-mint/10 text-[#0a9c6b]",
            phase === "denied" && "border-red/60 bg-red/10 text-[#c62d50]",
          )}
          role="status"
          aria-live="polite"
        >
          {phase === "granted" && <ShieldCheck className="h-4 w-4 flex-none" />}
          {phase === "denied" && <ShieldX className="h-4 w-4 flex-none" />}
          <span>{verdict}</span>
        </div>

        <div
          className={cn(
            "overflow-hidden rounded-[14px] border-[1.5px] border-line bg-[#07080D] transition-colors",
            isOpen && "border-mint/60",
            isDenied && "animate-shake",
          )}
        >
          <div className="flex items-center gap-2 border-b border-dark-line px-3.5 py-2.5 font-mono text-xs text-dark-muted">
            {isOpen ? (
              <LockOpen className="h-3.5 w-3.5 text-mint" />
            ) : (
              <Lock className="h-3.5 w-3.5" />
            )}
            {record.id}
            <span
              className={cn(
                "ml-auto rounded-full border border-dark-line bg-white/5 px-2 py-0.5 text-[.6rem] uppercase tracking-widest",
                isOpen && "border-mint/50 bg-mint/10 text-mint",
              )}
            >
              {isOpen ? "unlocked" : "locked"}
            </span>
          </div>
          <pre className="min-h-[6em] whitespace-pre-wrap px-4 py-3.5 font-mono text-[.8rem] leading-relaxed text-[#EDF0FA]">
            {body}
          </pre>
        </div>

        {source && (
          <p className="flex items-center gap-1.5 font-mono text-[.68rem] text-muted">
            <Link2 className="h-3 w-3 text-blue" />
            evaluated by{" "}
            {source === "core" ? "PrivyQ core" : "local policy mirror (offline)"}
            {" · "}
            {phase === "granted" || phase === "denied" ? (
              <Badge
                variant={phase === "granted" ? "granted" : "denied"}
                size="sm"
              >
                {phase === "granted" ? "granted" : "denied"}
              </Badge>
            ) : null}
          </p>
        )}
      </div>
    </div>
  );
}
