"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Policy } from "@/lib/types";
import { toBase64 } from "@/lib/utils";
import { api, ApiError, CoreOfflineError } from "@/services/api";
import { useIdentity } from "@/components/providers/identity-provider";
import { useRecords, type StoredRecord } from "@/components/providers/records-provider";
import { PolicyEditor } from "@/components/policy-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";

const DEFAULT_POLICY: Policy = {
  version: "1.0",
  combination: "all",
  conditions: [
    { type: "role", operator: "equals", value: "doctor" },
    { type: "department", operator: "equals", value: "cardiology" },
    { type: "purpose", operator: "equals", value: "treatment" },
  ],
  metadata: {},
};

const ALGORITHMS = ["kyber_768", "kyber_512", "kyber_1024"];

function slugId(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "record";
  return `${base}_${Math.random().toString(36).slice(2, 7)}`;
}

/** Build a readable clinical note from the form fields (this is the plaintext
 *  that gets encrypted). */
function composeChart(name: string, age: string, summary: string, notes: string): string {
  return [
    `Patient: ${name}${age ? ` (${age})` : ""}`,
    summary ? `Summary: ${summary}` : "",
    "",
    notes || "(no clinical notes provided)",
  ]
    .filter((l) => l !== undefined)
    .join("\n");
}

export function RecordForm({ onCreated }: { onCreated?: (r: StoredRecord) => void }) {
  const { persona } = useIdentity();
  const { addRecord } = useRecords();
  const router = useRouter();

  const [name, setName] = React.useState("");
  const [age, setAge] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [classification, setClassification] = React.useState("confidential");
  const [algorithm, setAlgorithm] = React.useState("kyber_768");
  const [policy, setPolicy] = React.useState<Policy>(DEFAULT_POLICY);

  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<StoredRecord | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setDone(null);
    if (!name.trim()) {
      setError("Patient name is required.");
      return;
    }
    setBusy(true);
    try {
      const resourceId = slugId(name);
      const plaintext = composeChart(name.trim(), age.trim(), summary.trim(), notes.trim());

      // The one call that actually protects the data through the core.
      const res = await api.protect({
        data: toBase64(plaintext),
        policy,
        algorithm,
        resource_id: resourceId,
        actor: persona.identity,
      });

      const record: StoredRecord = {
        id: resourceId,
        patientName: name.trim(),
        patientAge: age ? Number(age) : undefined,
        summary: summary.trim() || "Protected record",
        classification,
        algorithm: res.metadata.algorithm ?? algorithm,
        keyId: res.metadata.key_id ?? "",
        policyHash: res.metadata.policy_hash ?? "",
        createdAt: new Date().toISOString(),
        owner: persona.name,
        policy,
        protectedData: res.protected_data,
      };
      addRecord(record);
      setDone(record);
      onCreated?.(record);
      // reset the free-text fields for the next entry
      setName("");
      setAge("");
      setSummary("");
      setNotes("");
    } catch (err) {
      if (err instanceof CoreOfflineError) {
        setError("The core is offline — start the stack (make dev) to protect records.");
      } else if (err instanceof ApiError) {
        setError(`Gateway error (${err.status}): ${err.message}`);
      } else {
        setError("Unexpected error while protecting the record.");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Patient name
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Doe" />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Age
          <Input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" placeholder="58" />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Summary
        <Input value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Cardiology — echo + medication review" />
      </label>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Clinical notes (encrypted)
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={4}
          placeholder="Echo: mild LV hypertrophy. BP 132/84. Plan: continue beta-blocker…"
          className="rounded-[10px] border border-line bg-white px-3 py-2 font-mono text-sm outline-none focus-visible:ring-2 focus-visible:ring-blue/40"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Classification
          <Select value={classification} onChange={(e) => setClassification(e.target.value)}>
            {["public", "internal", "confidential", "restricted"].map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Algorithm
          <Select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
            {ALGORITHMS.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </Select>
        </label>
      </div>

      <div className="rounded-[14px] border border-line bg-tint/40 p-3">
        <p className="mb-2 text-sm font-semibold">Access policy</p>
        <PolicyEditor value={policy} onChange={setPolicy} />
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-lg bg-red/10 px-3 py-2 text-sm font-semibold text-red">
          <TriangleAlert className="h-4 w-4" /> {error}
        </p>
      )}
      {done && (
        <p className="flex items-center gap-2 rounded-lg bg-mint/10 px-3 py-2 text-sm font-semibold text-mint">
          <ShieldCheck className="h-4 w-4" /> Protected “{done.patientName}” under key {done.keyId.slice(0, 8)}… —{" "}
          <button type="button" className="underline" onClick={() => router.push(`/record/${done.id}`)}>
            open record
          </button>
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          {busy ? "Protecting…" : "Protect record"}
        </Button>
        <span className="text-xs text-muted">
          Protecting as <strong>{persona.name}</strong>
        </span>
      </div>
    </form>
  );
}
