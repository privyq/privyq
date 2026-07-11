"use client";

import * as React from "react";
import {
  Wallet,
  PenLine,
  ShieldQuestion,
  Loader2,
  CloudOff,
  CheckCircle2,
  FlaskConical,
  KeyRound,
} from "lucide-react";
import type { AbacIdentity, Decision, DecisionPolicy } from "@/lib/live";
import { api, CoreOfflineError } from "@/services/api";
import { cn } from "@/lib/utils";
import { PageHeading } from "@/components/page-heading";
import { DecisionView } from "@/components/decision-view";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * The canonical Web3 flow (blueprint §10, §14): a signed wallet challenge yields
 * a verified `wallet` subject attribute, which a policy can condition on. Here the
 * connect + sign steps are SIMULATED client-side (clearly labelled); the resulting
 * verified attribute is fed to the real PDP via POST /api/v1/check.
 */

const ALLOWED_WALLET = "0xA11CE0000000000000000000000000000000CAFE";

const WALLETS = [
  { id: "alice", label: "Alice", address: ALLOWED_WALLET, note: "on the allow-list" },
  { id: "mallory", label: "Mallory", address: "0xBADD0000000000000000000000000000000B0B00", note: "not on the allow-list" },
] as const;

const POLICY: DecisionPolicy = {
  policy_id: "web3-invoice-v1",
  combination: "all",
  conditions: [{ type: "wallet", operator: "equals", value: ALLOWED_WALLET }],
  obligations: ["log"],
};

type WalletId = (typeof WALLETS)[number]["id"];

export default function WalletPage() {
  const [walletId, setWalletId] = React.useState<WalletId | null>(null);
  const [challenge] = React.useState(
    () => "privyq-auth:" + Math.random().toString(16).slice(2, 10),
  );
  const [signed, setSigned] = React.useState(false);
  const [decision, setDecision] = React.useState<Decision | null>(null);
  const [offline, setOffline] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const wallet = WALLETS.find((w) => w.id === walletId) ?? null;

  // The identity sent to the PDP. The wallet attribute is only present once the
  // (simulated) challenge is signed — that is what flips the decision.
  const identity: AbacIdentity = {
    role: "member",
    purpose: "payment",
    ...(signed && wallet ? { wallet: wallet.address } : {}),
  };

  const fakeSignature = React.useMemo(
    () => (signed && wallet ? "0x" + hashish(wallet.address + challenge) : ""),
    [signed, wallet, challenge],
  );

  function connect(id: WalletId) {
    setWalletId(id);
    setSigned(false);
    setDecision(null);
  }

  async function requestAccess() {
    setBusy(true);
    setOffline(false);
    setDecision(null);
    try {
      const d = await api.check({ identity, policy: POLICY });
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
        eyebrow="Wallet identity"
        title="Wallet-authenticated access"
        description="A signed wallet challenge becomes a verified subject attribute the policy can require. Authenticate, then request a protected invoice — the same PDP that governs every other service decides. No smart contract, no duplicated backend logic."
      />

      <div className="mb-5 flex items-start gap-2.5 rounded-xl border border-amber/40 bg-amber/[.08] px-4 py-3 text-sm text-ink-2">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-[#a76a00]" />
        <p>
          <strong>Simulated:</strong> the connect and signature steps run entirely in your browser — no real
          wallet, no real signature. In production PrivyQ’s core verifies the signed challenge cryptographically
          before trusting the <code className="font-mono text-xs">wallet</code> attribute. The policy decision on the
          right is <strong>real</strong> — it calls the live PDP.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Left: the wallet flow */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">1</span>
                  Connect a wallet
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="grid grid-cols-2 gap-2">
                {WALLETS.map((w) => (
                  <button
                    key={w.id}
                    type="button"
                    onClick={() => connect(w.id)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors",
                      walletId === w.id ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
                    )}
                  >
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold">
                      <Wallet className="h-4 w-4" /> {w.label}
                    </span>
                    <span className={cn("text-[11px]", walletId === w.id ? "text-white/70" : "text-muted")}>{w.note}</span>
                  </button>
                ))}
              </div>
              {wallet && (
                <p className="break-all font-mono text-[11px] text-muted">
                  connected: <span className="text-ink-2">{wallet.address}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card className={cn(!wallet && "opacity-50")}>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">2</span>
                  Sign the challenge
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <div className="rounded-lg border border-line bg-tint px-3 py-2 font-mono text-[11px] text-ink-2">
                challenge = {challenge}
              </div>
              <Button variant={signed ? "mint" : "ink"} disabled={!wallet || signed} onClick={() => setSigned(true)}>
                {signed ? <CheckCircle2 className="h-4 w-4" /> : <PenLine className="h-4 w-4" />}
                {signed ? "Challenge signed (simulated)" : "Sign challenge"}
              </Button>
              {signed && (
                <p className="break-all font-mono text-[11px] text-muted">
                  <KeyRound className="mr-1 inline h-3 w-3" />
                  signature: <span className="text-ink-2">{fakeSignature}</span>
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Identity sent to the PDP</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="scroll-thin overflow-x-auto rounded-xl border border-line bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-white/90">
                {JSON.stringify(identity, null, 2)}
              </pre>
              <p className="mt-2 text-xs text-muted">
                {signed
                  ? "The verified wallet attribute is present — the policy can now match it."
                  : "No verified wallet attribute yet — the policy’s wallet condition will fail."}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Right: the decision */}
        <div className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle>
                <span className="inline-flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-ink text-[11px] font-bold text-white">3</span>
                  Request the protected invoice
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <Button onClick={requestAccess} disabled={busy || !wallet}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldQuestion className="h-4 w-4" />}
                Run check
              </Button>
              {offline ? (
                <p className="flex items-center gap-2 text-amber">
                  <CloudOff className="h-4 w-4" /> Core offline — start the stack to evaluate.
                </p>
              ) : !decision ? (
                <p className="text-sm text-muted">
                  {wallet
                    ? "Sign the challenge, then run the check to see how the verified wallet flips the decision."
                    : "Connect a wallet to begin."}
                </p>
              ) : (
                <DecisionView decision={decision} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>The policy</CardTitle>
            </CardHeader>
            <CardContent>
              <pre className="scroll-thin overflow-x-auto rounded-xl border border-line bg-ink p-4 font-mono text-[11.5px] leading-relaxed text-white/90">
                {JSON.stringify(POLICY, null, 2)}
              </pre>
              <p className="mt-2 text-xs text-muted">
                Alice’s address is on the allow-list, so a signed Alice is granted; Mallory — even signed — is denied.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

/** A tiny deterministic hex string — purely cosmetic, to look like a signature. */
function hashish(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const base = (h >>> 0).toString(16).padStart(8, "0");
  return (base + base + base + base + base + base + base + base).slice(0, 128);
}
