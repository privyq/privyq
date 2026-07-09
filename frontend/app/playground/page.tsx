"use client";

import * as React from "react";
import { Play, CheckCircle2, XCircle } from "lucide-react";
import type { Identity, Policy, PolicyEvaluation } from "@/lib/types";
import { evaluatePolicy } from "@/lib/policy";
import { PERSONAS } from "@/lib/personas";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { PolicyEditor } from "@/components/policy-editor";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const STARTER_POLICY: Policy = {
  version: "1.0",
  combination: "all",
  conditions: [
    { type: "role", operator: "equals", value: "doctor" },
    { type: "department", operator: "in", value: ["cardiology", "oncology"] },
    { type: "purpose", operator: "one_of", value: ["treatment", "research"] },
  ],
};

export default function PlaygroundPage() {
  const [policy, setPolicy] = React.useState<Policy>(STARTER_POLICY);
  const [identity, setIdentity] = React.useState<Identity>({
    ...PERSONAS[0]!.identity,
  });
  const [result, setResult] = React.useState<PolicyEvaluation | null>(null);

  const setField = (field: keyof Identity, value: string) =>
    setIdentity((prev) => ({ ...prev, [field]: value }));

  const run = () => setResult(evaluatePolicy(policy, identity));

  return (
    <div>
      <PageHeading
        eyebrow="Playground"
        title="Policy playground"
        description="Test a policy against any identity and watch each condition pass or fail. Runs against the local policy mirror so it works with or without a backend."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Policy</CardTitle>
            <CardDescription>Edit conditions and combination.</CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyEditor value={policy} onChange={setPolicy} />
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Identity / context</CardTitle>
              <CardDescription>Load a persona or edit fields.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-1.5">
                {PERSONAS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setIdentity({ ...p.identity })}
                    className="rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-ink hover:text-ink"
                  >
                    {p.name}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(
                  ["role", "department", "purpose", "organization"] as const
                ).map((field) => (
                  <div key={field}>
                    <Label htmlFor={field}>{field}</Label>
                    <Input
                      id={field}
                      value={identity[field] ?? ""}
                      onChange={(e) => setField(field, e.target.value)}
                    />
                  </div>
                ))}
              </div>
              <Button onClick={run}>
                <Play className="h-4 w-4" />
                Evaluate policy
              </Button>
            </CardContent>
          </Card>

          {result && (
            <Card
              className={cn(
                result.decision === "granted"
                  ? "border-mint/50"
                  : "border-red/50",
              )}
            >
              <CardHeader className="flex-row items-center gap-2">
                {result.decision === "granted" ? (
                  <CheckCircle2 className="h-5 w-5 text-mint" />
                ) : (
                  <XCircle className="h-5 w-5 text-red" />
                )}
                <CardTitle>
                  {result.decision === "granted"
                    ? "Access would be granted"
                    : "Access would be denied"}
                </CardTitle>
                <Badge
                  variant={result.decision === "granted" ? "granted" : "denied"}
                  size="sm"
                  className="ml-auto"
                >
                  {result.decision}
                </Badge>
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <p className="text-sm text-muted">{result.reason}</p>
                <ul className="flex flex-col gap-1.5">
                  {result.evaluated_conditions.map((c, i) => (
                    <li
                      key={i}
                      className="flex items-center gap-2 rounded-[10px] border border-line bg-tint/40 px-3 py-2 text-sm"
                    >
                      {c.result ? (
                        <CheckCircle2 className="h-4 w-4 flex-none text-mint" />
                      ) : (
                        <XCircle className="h-4 w-4 flex-none text-red" />
                      )}
                      <span className="font-mono text-xs">
                        {c.type}: expected{" "}
                        {JSON.stringify(c.expected)}, got &ldquo;
                        {c.actual || "—"}&rdquo;
                      </span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
