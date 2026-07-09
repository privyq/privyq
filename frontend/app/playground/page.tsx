"use client";

import * as React from "react";
import { Play, CheckCircle2, XCircle, CloudOff, Loader2 } from "lucide-react";
import type { Identity, Policy } from "@/lib/types";
import type { EvaluationResult } from "@/lib/live";
import { api, CoreOfflineError } from "@/services/api";
import { PERSONAS } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { PolicyEditor } from "@/components/policy-editor";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const START_POLICY: Policy = {
  version: "1.0",
  combination: "all",
  conditions: [
    { type: "role", operator: "equals", value: "doctor" },
    { type: "department", operator: "in", value: ["cardiology", "oncology"] },
    { type: "purpose", operator: "equals", value: "treatment" },
  ],
  metadata: {},
};

export default function PlaygroundPage() {
  const [policy, setPolicy] = React.useState<Policy>(START_POLICY);
  const [identity, setIdentity] = React.useState<Identity>({
    user_id: "test_user",
    role: "doctor",
    department: "cardiology",
    purpose: "treatment",
    organization: "Hospital A",
  });
  const [result, setResult] = React.useState<EvaluationResult | null>(null);
  const [offline, setOffline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const set = (patch: Partial<Identity>) => setIdentity((prev) => ({ ...prev, ...patch }));

  async function evaluate() {
    setBusy(true);
    setOffline(false);
    setResult(null);
    try {
      const res = await api.policyEvaluate({ policy, identity });
      setResult(res);
    } catch (err) {
      if (err instanceof CoreOfflineError) setOffline(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Playground"
        title="Policy playground"
        description="Craft a policy and an identity, then evaluate it against the core's real policy engine — no data is encrypted and nothing is logged. See exactly which conditions pass and fail."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Policy</CardTitle></CardHeader>
          <CardContent><PolicyEditor value={policy} onChange={setPolicy} /></CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader><CardTitle>Identity</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-wrap gap-1.5">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setIdentity(p.identity)}
                    className="rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold hover:border-ink"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(["role", "department", "purpose", "organization"] as const).map((field) => (
                  <div key={field} className="flex flex-col gap-1">
                    <Label className="capitalize">{field}</Label>
                    <Input value={identity[field] ?? ""} onChange={(e) => set({ [field]: e.target.value })} />
                  </div>
                ))}
              </div>
              <Button onClick={evaluate} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Evaluate
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Decision</CardTitle></CardHeader>
            <CardContent>
              {offline ? (
                <p className="flex items-center gap-2 text-amber"><CloudOff className="h-4 w-4" /> Core offline — start the stack to evaluate.</p>
              ) : !result ? (
                <p className="text-sm text-muted">Evaluate a policy to see the decision and per-condition breakdown.</p>
              ) : (
                <div className="flex flex-col gap-3">
                  <div className="flex items-center gap-2">
                    {result.decision === "granted" ? (
                      <Badge variant="granted"><CheckCircle2 className="h-3.5 w-3.5" /> granted</Badge>
                    ) : (
                      <Badge variant="denied"><XCircle className="h-3.5 w-3.5" /> denied</Badge>
                    )}
                    <span className="text-sm text-muted">{result.reason}</span>
                  </div>
                  <ul className="flex flex-col gap-1.5">
                    {result.evaluated_conditions.map((c, i) => (
                      <li key={i} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs", c.result ? "border-mint/40 bg-mint/5" : "border-red/40 bg-red/5")}>
                        {c.result ? <CheckCircle2 className="h-4 w-4 text-mint" /> : <XCircle className="h-4 w-4 text-red" />}
                        <span className="font-mono">{c.type}</span>
                        <span className="text-muted">{c.expected}</span>
                        <span className="ml-auto font-mono">got: {c.actual || "—"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
