"use client";

import * as React from "react";
import {
  Play,
  Loader2,
  CloudOff,
  Stethoscope,
  Landmark,
  BrainCircuit,
  Scale,
  Network,
  ArrowRight,
} from "lucide-react";
import type { AbacIdentity, Decision, DecisionPolicy } from "@/lib/live";
import { api, CoreOfflineError } from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { DecisionView } from "@/components/decision-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

/* ── Scenario model ──────────────────────────────────────────────────────── */

type FieldKind = "text" | "number" | "select" | "boolean";

interface FieldDef {
  key: string;
  label: string;
  kind: FieldKind;
  options?: string[];
}

interface SubjectPreset {
  name: string;
  hint: string;
  identity: AbacIdentity;
}

interface Scenario {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  blurb: string;
  /** Services that would call this one policy in a real deployment (PDP framing). */
  services: string[];
  policy: DecisionPolicy;
  fields: FieldDef[];
  presets: SubjectPreset[];
}

const SCENARIOS: Scenario[] = [
  {
    id: "healthcare",
    icon: Stethoscope,
    title: "Healthcare · record access",
    blurb:
      "A clinical record opens for the treating clinician or an approved researcher — and every grant masks patient PII and is logged (an obligation).",
    services: ["ehr-api", "research-portal", "mobile-app"],
    policy: {
      policy_id: "medical-record-v2",
      combination: "all",
      conditions: [
        { type: "role", operator: "in", value: ["doctor", "researcher"] },
        { type: "purpose", operator: "in", value: ["treatment", "research"] },
      ],
      obligations: ["mask:patient_name", "log"],
    },
    fields: [
      { key: "role", label: "role", kind: "select", options: ["doctor", "nurse", "researcher"] },
      { key: "department", label: "department", kind: "text" },
      { key: "purpose", label: "purpose", kind: "select", options: ["treatment", "research", "administrative"] },
    ],
    presets: [
      { name: "Dr. Amara — treatment", hint: "allowed, masked", identity: { role: "doctor", department: "cardiology", purpose: "treatment" } },
      { name: "Nurse Bello — admin", hint: "denied", identity: { role: "nurse", department: "general", purpose: "administrative" } },
      { name: "Riley Chen — research", hint: "allowed, masked", identity: { role: "researcher", department: "oncology", purpose: "research" } },
    ],
  },
  {
    id: "banking",
    icon: Landmark,
    title: "Banking · approval limit + break-glass",
    blurb:
      "A manager may approve an invoice within their limit — or above it in a flagged emergency (break-glass). Expressed as one sandboxed rule, not an if-ladder.",
    services: ["payments-svc", "approvals-svc", "back-office"],
    policy: {
      policy_id: "invoice-approval-v3",
      combination: "custom",
      custom_logic: 'role == "manager" and (amount <= approval_limit or emergency)',
      obligations: ["log", "mask:account_no"],
    },
    fields: [
      { key: "role", label: "role", kind: "select", options: ["manager", "reviewer", "clerk"] },
      { key: "amount", label: "amount (₦)", kind: "number" },
      { key: "approval_limit", label: "approval_limit (₦)", kind: "number" },
      { key: "emergency", label: "emergency (break-glass)", kind: "boolean" },
    ],
    presets: [
      { name: "Within limit", hint: "allowed", identity: { role: "manager", amount: 500000, approval_limit: 1000000, emergency: false } },
      { name: "Over limit", hint: "denied", identity: { role: "manager", amount: 2000000, approval_limit: 1000000, emergency: false } },
      { name: "Break-glass", hint: "allowed", identity: { role: "manager", amount: 2000000, approval_limit: 1000000, emergency: true } },
      { name: "Reviewer", hint: "denied", identity: { role: "reviewer", amount: 100, approval_limit: 1000000, emergency: false } },
    ],
  },
  {
    id: "ai",
    icon: BrainCircuit,
    title: "AI infrastructure · subscription + credits",
    blurb:
      "Gate a model or dataset by plan and remaining credits. One policy governs every service that fronts the model.",
    policy: {
      policy_id: "ai-model-access",
      combination: "custom",
      custom_logic: 'subscription == "pro" and credits > 0',
    },
    services: ["inference-api", "batch-jobs", "playground"],
    fields: [
      { key: "subscription", label: "subscription", kind: "select", options: ["free", "pro"] },
      { key: "credits", label: "credits", kind: "number" },
    ],
    presets: [
      { name: "Pro, has credits", hint: "allowed", identity: { subscription: "pro", credits: 5 } },
      { name: "Pro, no credits", hint: "denied", identity: { subscription: "pro", credits: 0 } },
      { name: "Free plan", hint: "denied", identity: { subscription: "free", credits: 100 } },
    ],
  },
  {
    id: "legal",
    icon: Scale,
    title: "Legal · delegated counsel",
    blurb:
      "Privileged files open only for counsel with an active delegation — with a watermark obligation on every view.",
    policy: {
      policy_id: "privileged-file-v1",
      combination: "all",
      conditions: [
        { type: "role", operator: "equals", value: "counsel" },
        { type: "delegation", operator: "equals", value: "granted" },
      ],
      obligations: ["watermark", "log"],
    },
    services: ["docs-api", "review-portal"],
    fields: [
      { key: "role", label: "role", kind: "select", options: ["counsel", "paralegal", "client"] },
      { key: "delegation", label: "delegation", kind: "select", options: ["granted", "none"] },
    ],
    presets: [
      { name: "Delegated counsel", hint: "allowed", identity: { role: "counsel", delegation: "granted" } },
      { name: "Counsel, no delegation", hint: "denied", identity: { role: "counsel", delegation: "none" } },
      { name: "Paralegal", hint: "denied", identity: { role: "paralegal", delegation: "granted" } },
    ],
  },
];

/* ── Page ────────────────────────────────────────────────────────────────── */

export default function ExplorerPage() {
  const [scenarioId, setScenarioId] = React.useState(SCENARIOS[0]!.id);
  const scenario = SCENARIOS.find((s) => s.id === scenarioId)!;

  const [identity, setIdentity] = React.useState<AbacIdentity>(scenario.presets[0]!.identity);
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [offline, setOffline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  function pickScenario(id: string) {
    const next = SCENARIOS.find((s) => s.id === id)!;
    setScenarioId(id);
    setIdentity(next.presets[0]!.identity);
    setDecision(null);
    setOffline(false);
  }

  function setField(key: string, value: string | number | boolean) {
    setIdentity((prev) => ({ ...prev, [key]: value }));
  }

  async function run() {
    setBusy(true);
    setOffline(false);
    setDecision(null);
    try {
      const d = await api.check({ identity, policy: scenario.policy });
      setDecision(d);
    } catch (err) {
      if (err instanceof CoreOfflineError) setOffline(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Decision Explorer"
        title="One policy brain, every service"
        description="Pick an identity and a resource policy, then ask the Policy Decision Point: can this identity do this? The core returns a Decision — allowed or denied, a human reason, the conditions that matched and failed, and any obligations. No data is revealed; this is the pure check() verb."
      />

      {/* Scenario picker */}
      <div className="mb-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {SCENARIOS.map((s) => {
          const Icon = s.icon;
          const active = s.id === scenarioId;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => pickScenario(s.id)}
              className={cn(
                "flex items-start gap-2.5 rounded-xl border p-3 text-left transition-colors",
                active ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg",
                  active ? "bg-white/15 text-white" : "bg-blue/10 text-blue",
                )}
              >
                <Icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-bold">{s.title}</span>
                <span className={cn("mt-0.5 block text-[11px]", active ? "text-white/70" : "text-muted")}>
                  {s.policy.combination === "custom" ? "custom expression" : `${s.policy.combination} conditions`}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: identity + policy */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Identity — the ABAC subject</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <p className="text-sm text-muted">{scenario.blurb}</p>
              <div className="flex flex-wrap gap-1.5">
                {scenario.presets.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setIdentity(p.identity);
                      setDecision(null);
                    }}
                    className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold hover:border-ink"
                    title={p.hint}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {scenario.fields.map((f) => (
                  <FieldInput key={f.key} field={f} value={identity[f.key]} onChange={setField} />
                ))}
              </div>
              <Button onClick={run} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Run check
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>The policy — describe, don’t code</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-sm text-muted">
                This is the whole authorization rule for <code className="font-mono text-xs">{scenario.policy.policy_id}</code>.
                Your services never re-implement it — they call the PDP.
              </p>
              <pre className="scroll-thin overflow-x-auto rounded-xl border border-line bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-white/90">
                {JSON.stringify(scenario.policy, null, 2)}
              </pre>
            </CardContent>
          </Card>
        </div>

        {/* Right: decision + PDP framing */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Decision</CardTitle>
            </CardHeader>
            <CardContent>
              {offline ? (
                <p className="flex items-center gap-2 text-amber">
                  <CloudOff className="h-4 w-4" /> Core offline — start the stack to evaluate against the real PDP.
                </p>
              ) : !decision ? (
                <p className="text-sm text-muted">
                  Choose an identity and run the check to see the decision, its reason, the matched/failed
                  conditions, and any obligations.
                </p>
              ) : (
                <DecisionView decision={decision} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <Network className="h-4 w-4 text-blue" /> Policy-Decision-as-a-Service
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-3 text-sm text-muted">
                In a real deployment, every one of these services asks the same PDP the same question — so the
                answer is identical everywhere, tested once, and provable in the audit trail.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                {scenario.services.map((svc) => (
                  <span
                    key={svc}
                    className="rounded-lg border border-line bg-tint px-2.5 py-1.5 font-mono text-[11px] text-ink-2"
                  >
                    {svc}
                  </span>
                ))}
                <ArrowRight className="h-4 w-4 text-muted" />
                <span className="rounded-lg border border-blue/40 bg-blue/[.06] px-2.5 py-1.5 font-mono text-[11px] font-semibold text-blue">
                  POST /api/v1/check
                </span>
                <ArrowRight className="h-4 w-4 text-muted" />
                <span className="rounded-lg border border-ink bg-ink px-2.5 py-1.5 font-mono text-[11px] font-semibold text-white">
                  PrivyQ core (PDP)
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function FieldInput({
  field,
  value,
  onChange,
}: {
  field: FieldDef;
  value: string | number | boolean | undefined;
  onChange: (key: string, value: string | number | boolean) => void;
}) {
  if (field.kind === "boolean") {
    const on = value === true || value === "true";
    return (
      <div className="col-span-2 flex items-center justify-between rounded-[10px] border-[1.5px] border-line bg-white px-3.5 py-2.5">
        <Label className="mb-0 normal-case">{field.label}</Label>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          onClick={() => onChange(field.key, !on)}
          className={cn(
            "relative h-6 w-11 rounded-full transition-colors",
            on ? "bg-mint" : "bg-line",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
              on ? "translate-x-[22px]" : "translate-x-0.5",
            )}
          />
        </button>
      </div>
    );
  }
  return (
    <div className="flex flex-col">
      <Label>{field.label}</Label>
      {field.kind === "select" ? (
        <Select value={String(value ?? "")} onChange={(e) => onChange(field.key, e.target.value)}>
          {field.options?.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </Select>
      ) : (
        <Input
          type={field.kind === "number" ? "number" : "text"}
          value={value === undefined ? "" : String(value)}
          onChange={(e) =>
            onChange(field.key, field.kind === "number" ? Number(e.target.value) : e.target.value)
          }
        />
      )}
    </div>
  );
}
