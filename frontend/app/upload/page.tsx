"use client";

import * as React from "react";
import { Lock, Loader2, ShieldCheck } from "lucide-react";
import type { Policy, ProtectResponse } from "@/lib/types";
import { api, CoreOfflineError } from "@/services/api";
import { fakeHash, toBase64 } from "@/lib/utils";
import { useIdentity } from "@/components/providers/identity-provider";
import { PageHeading } from "@/components/page-heading";
import { PolicyEditor } from "@/components/policy-editor";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input, Textarea, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const DEFAULT_POLICY: Policy = {
  version: "1.0",
  combination: "all",
  conditions: [
    { type: "role", operator: "equals", value: "doctor" },
    { type: "department", operator: "equals", value: "cardiology" },
    { type: "purpose", operator: "equals", value: "treatment" },
    { type: "classification", operator: "equals", value: "confidential" },
    { type: "expiry", operator: "before", value: "2026-12-31T23:59:59Z" },
  ],
};

interface Result extends ProtectResponse {
  source: "core" | "local";
}

export default function UploadPage() {
  const { persona } = useIdentity();
  const [patient, setPatient] = React.useState("John Doe");
  const [record, setRecord] = React.useState(
    "Echo: mild LV hypertrophy. BP 132/84.\nPlan: continue beta-blocker, review in 2 weeks.",
  );
  const [algorithm, setAlgorithm] = React.useState("kyber_768");
  const [policy, setPolicy] = React.useState<Policy>(DEFAULT_POLICY);
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Result | null>(null);

  async function protect(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    const body = {
      data: toBase64(`Patient: ${patient}\n${record}`),
      policy,
      algorithm,
      resource_id: `patient_${fakeHash(4)}`,
    };
    try {
      const res = await api.protect(body);
      setResult({ ...res, source: "core" });
    } catch (err) {
      // offline (or any error): build a representative local result so the
      // flow still completes and the design is visible
      void (err instanceof CoreOfflineError);
      const now = new Date().toISOString();
      setResult({
        source: "local",
        protected_data: "▓▓▓▓ base64_ciphertext ▓▓▓▓",
        metadata: {
          algorithm,
          policy_hash: fakeHash(40),
          timestamp: now,
          key_id: `key_${fakeHash(6)}`,
        },
        evidence: {
          evidence_id: `ev_${fakeHash(8)}`,
          timestamp: now,
          signature: `${fakeHash(4)}…${fakeHash(4)}`,
          operation: "protect",
          result: "granted",
        },
      });
    }
    setBusy(false);
  }

  return (
    <div>
      <PageHeading
        eyebrow="Protect"
        title="Upload a patient record"
        description="Attach a privacy policy and encrypt in one step. The rules travel inside the ciphertext and are enforced before any future decryption."
      />

      <form onSubmit={protect} className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Record</CardTitle>
            <CardDescription>
              Uploaded by {persona.name} ({persona.identity.department})
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Label htmlFor="patient">Patient name</Label>
              <Input
                id="patient"
                value={patient}
                onChange={(e) => setPatient(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="record">Clinical notes</Label>
              <Textarea
                id="record"
                value={record}
                onChange={(e) => setRecord(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="algo">Encryption algorithm</Label>
              <Select
                id="algo"
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value)}
              >
                <option value="kyber_512">kyber_512 (NIST L1)</option>
                <option value="kyber_768">kyber_768 (NIST L3, default)</option>
                <option value="kyber_1024">kyber_1024 (NIST L5)</option>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policy editor</CardTitle>
            <CardDescription>
              Conditions evaluated at access time (BP §14.1).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <PolicyEditor value={policy} onChange={setPolicy} />
          </CardContent>
        </Card>

        <div className="lg:col-span-2">
          <Button type="submit" disabled={busy} size="lg">
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {busy ? "Encrypting…" : "Protect record"}
          </Button>
        </div>
      </form>

      {result && (
        <Card className="mt-6 border-mint/50">
          <CardHeader className="flex-row items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-mint" />
            <CardTitle>Record protected</CardTitle>
            <Badge
              variant={result.source === "core" ? "granted" : "amber"}
              size="sm"
              className="ml-auto"
            >
              {result.source === "core" ? "core" : "offline demo"}
            </Badge>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="mb-1.5 font-mono text-[.7rem] uppercase tracking-wide text-muted">
                Protected data
              </p>
              <pre className="scroll-thin overflow-x-auto rounded-[10px] bg-[#07080D] px-3.5 py-3 font-mono text-xs text-[#8FA0FF]">
                {result.protected_data}
              </pre>
            </div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-xs">
              <dt className="text-muted">algorithm</dt>
              <dd>{result.metadata.algorithm}</dd>
              <dt className="text-muted">policy_hash</dt>
              <dd className="truncate">{result.metadata.policy_hash}</dd>
              <dt className="text-muted">key_id</dt>
              <dd>{result.metadata.key_id}</dd>
              <dt className="text-muted">evidence_id</dt>
              <dd>{result.evidence.evidence_id}</dd>
              <dt className="text-muted">signature</dt>
              <dd className="truncate">{result.evidence.signature}</dd>
            </dl>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
