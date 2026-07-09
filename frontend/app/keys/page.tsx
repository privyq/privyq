"use client";

import * as React from "react";
import { KeyRound, Plus, RefreshCw, Ban, Loader2, CloudOff } from "lucide-react";
import { api, ApiError, CoreOfflineError } from "@/services/api";
import type { ManagedKey } from "@/lib/live";
import { shortDateTime, cn } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input, Label } from "@/components/ui/input";

const STATUS_VARIANT: Record<string, "granted" | "amber" | "denied" | "muted"> = {
  active: "granted",
  rotated: "amber",
  revoked: "denied",
  expired: "muted",
};

export default function KeysPage() {
  const [keys, setKeys] = React.useState<ManagedKey[]>([]);
  const [state, setState] = React.useState<"loading" | "ready" | "offline">("loading");
  const [busy, setBusy] = React.useState<string | null>(null);
  const [algorithm, setAlgorithm] = React.useState("kyber_768");
  const [keyType, setKeyType] = React.useState("encryption");
  const [owner, setOwner] = React.useState("");

  const load = React.useCallback(async () => {
    setState("loading");
    try {
      const res = await api.keysList();
      setKeys(res.keys);
      setState("ready");
    } catch (err) {
      setState(err instanceof CoreOfflineError ? "offline" : "ready");
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  async function generate() {
    setBusy("generate");
    try {
      await api.keysGenerate({ algorithm, type: keyType, owner: owner || "operator" });
      setOwner("");
      await load();
    } catch {
      /* surfaced by reload / offline state */
    } finally {
      setBusy(null);
    }
  }

  async function rotate(id: string) {
    setBusy(id);
    try { await api.keysRotate(id); await load(); } catch { /* ignore */ } finally { setBusy(null); }
  }
  async function revoke(id: string) {
    setBusy(id);
    try { await api.keysRevoke(id); await load(); } catch { /* ignore */ } finally { setBusy(null); }
  }

  return (
    <div>
      <PageHeading
        eyebrow="Key management"
        title="Keys"
        description="Post-quantum key pairs managed by the core. Generate new keys, rotate them (old key retained for historical data), or revoke them to cut off access."
      >
        <Button variant="ghost" onClick={load}><RefreshCw className="h-4 w-4" /> Refresh</Button>
      </PageHeading>

      {state === "offline" ? (
        <Card><CardContent className="flex items-center gap-2 py-10 text-amber">
          <CloudOff className="h-5 w-5" /> Core offline — start the stack to manage keys.
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[1fr_1.6fr]">
          <Card>
            <CardHeader><CardTitle>Generate a key</CardTitle></CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Label>Type</Label>
                <Select value={keyType} onChange={(e) => setKeyType(e.target.value)}>
                  <option value="encryption">encryption</option>
                  <option value="signing">signing</option>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Algorithm</Label>
                <Select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
                  {["kyber_768", "kyber_512", "kyber_1024", "dilithium_3"].map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Label>Owner</Label>
                <Input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="e.g. dr_amara" />
              </div>
              <Button onClick={generate} disabled={busy === "generate"}>
                {busy === "generate" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Generate
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{keys.length} managed key{keys.length === 1 ? "" : "s"}</CardTitle></CardHeader>
            <CardContent>
              {state === "loading" ? (
                <p className="text-muted">Loading…</p>
              ) : keys.length === 0 ? (
                <p className="text-sm text-muted">No keys yet — generate one, or protect a record (which mints one automatically).</p>
              ) : (
                <ul className="flex flex-col divide-y divide-line">
                  {keys.map((k) => (
                    <li key={k.key_id} className="flex flex-wrap items-center gap-3 py-3">
                      <KeyRound className="h-4 w-4 text-blue" />
                      <div className="min-w-0">
                        <p className="truncate font-mono text-xs">{k.key_id}</p>
                        <p className="text-xs text-muted">
                          {k.algorithm} · {k.type}{k.owner ? ` · ${k.owner}` : ""} · {shortDateTime(k.created_at)}
                        </p>
                      </div>
                      <Badge variant={STATUS_VARIANT[k.status] ?? "muted"} className="ml-auto">{k.status}</Badge>
                      {k.status === "active" && (
                        <div className="flex gap-1.5">
                          <Button variant="outline" size="sm" disabled={busy === k.key_id} onClick={() => rotate(k.key_id)}>
                            <RefreshCw className="h-3.5 w-3.5" /> Rotate
                          </Button>
                          <Button variant="outline" size="sm" disabled={busy === k.key_id} onClick={() => revoke(k.key_id)}>
                            <Ban className="h-3.5 w-3.5" /> Revoke
                          </Button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
