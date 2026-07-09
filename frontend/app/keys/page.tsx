"use client";

import * as React from "react";
import { KeyRound, Plus, RefreshCw, Ban, Loader2 } from "lucide-react";
import type { KeyAlgorithm, KeyResponse, KeyType } from "@/lib/types";
import { api, CoreOfflineError } from "@/services/api";
import { DEMO_KEYS } from "@/lib/demo-data";
import { fakeHash } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { KeyStatusIndicator } from "@/components/key-status-indicator";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { Label } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

function newLocalKey(algorithm: KeyAlgorithm, type: KeyType): KeyResponse {
  const now = new Date();
  const expires = new Date(now.getTime() + 183 * 86_400_000);
  return {
    key_id: `key_${fakeHash(6)}`,
    public_key: `MIIBIjANBgkqh...${algorithm}...QIDAQAB`,
    algorithm,
    type,
    status: "active",
    created_at: now.toISOString(),
    expires_at: expires.toISOString(),
  };
}

export default function KeysPage() {
  const [keys, setKeys] = React.useState<KeyResponse[]>(DEMO_KEYS);
  const [algorithm, setAlgorithm] = React.useState<KeyAlgorithm>("kyber_768");
  const [type, setType] = React.useState<KeyType>("encryption");
  const [busy, setBusy] = React.useState<string | null>(null);

  async function generate() {
    setBusy("generate");
    try {
      const res = await api.keysGenerate({ algorithm, type });
      setKeys((prev) => [{ ...res, status: res.status ?? "active" }, ...prev]);
    } catch (err) {
      void (err instanceof CoreOfflineError);
      setKeys((prev) => [newLocalKey(algorithm, type), ...prev]);
    }
    setBusy(null);
  }

  async function rotate(keyId: string) {
    setBusy(keyId);
    let newKey: KeyResponse;
    const source = keys.find((k) => k.key_id === keyId);
    try {
      const res = await api.keysRotate(keyId);
      newKey = newLocalKey(
        (source?.algorithm as KeyAlgorithm) ?? "kyber_768",
        (source?.type as KeyType) ?? "encryption",
      );
      newKey.key_id = res.new_key_id;
    } catch {
      newKey = newLocalKey(
        (source?.algorithm as KeyAlgorithm) ?? "kyber_768",
        (source?.type as KeyType) ?? "encryption",
      );
    }
    setKeys((prev) => [
      newKey,
      ...prev.map((k) =>
        k.key_id === keyId ? { ...k, status: "rotated" as const } : k,
      ),
    ]);
    setBusy(null);
  }

  async function revoke(keyId: string) {
    setBusy(keyId);
    try {
      await api.keysRevoke(keyId);
    } catch {
      /* offline — update locally */
    }
    setKeys((prev) =>
      prev.map((k) =>
        k.key_id === keyId ? { ...k, status: "revoked" as const } : k,
      ),
    );
    setBusy(null);
  }

  return (
    <div>
      <PageHeading
        eyebrow="Keys"
        title="Key management"
        description="Generate, rotate, and revoke post-quantum keys. Rotated keys are retained to decrypt older data; revoked keys are denied everywhere."
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_2fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle>Generate key</CardTitle>
            <CardDescription>CRYSTALS-Kyber / Dilithium (BP App C).</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div>
              <Label htmlFor="algo">Algorithm</Label>
              <Select
                id="algo"
                value={algorithm}
                onChange={(e) =>
                  setAlgorithm(e.target.value as KeyAlgorithm)
                }
              >
                <option value="kyber_512">kyber_512 (NIST L1)</option>
                <option value="kyber_768">kyber_768 (NIST L3)</option>
                <option value="kyber_1024">kyber_1024 (NIST L5)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="type">Purpose</Label>
              <Select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value as KeyType)}
              >
                <option value="encryption">encryption</option>
                <option value="signing">signing</option>
              </Select>
            </div>
            <Button onClick={generate} disabled={busy === "generate"}>
              {busy === "generate" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Generate key
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-3 sm:grid-cols-2">
          {keys.map((k) => (
            <KeyStatusIndicator
              key={k.key_id}
              keyData={k}
              actions={
                k.status === "active" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => rotate(k.key_id)}
                      disabled={busy === k.key_id}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Rotate
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => revoke(k.key_id)}
                      disabled={busy === k.key_id}
                      className="text-red hover:bg-red/10"
                    >
                      <Ban className="h-3.5 w-3.5" />
                      Revoke
                    </Button>
                  </>
                ) : (
                  <span className="flex items-center gap-1.5 font-mono text-[.68rem] text-muted">
                    <KeyRound className="h-3.5 w-3.5" />
                    no actions available
                  </span>
                )
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}
