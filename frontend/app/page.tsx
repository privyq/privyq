"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight, Lock, LockOpen, ShieldX, ScrollText, ShieldCheck, Copy, Check,
  Github, Stethoscope, Landmark, Scale, BrainCircuit, KeyRound, FileCheck2, Link2,
} from "lucide-react";
import { GITHUB_URL, PYPI_URL } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/* PrivyQ landing / marketing page — the entry point. */

export default function Landing() {
  return (
    <div className="flex flex-col gap-28 pb-20">
      <Hero />
      <TrustStrip />
      <Features />
      <HowItWorks />
      <UseCases />
      <Quickstart />
      <CtaBand />
      <Footer />
    </div>
  );
}

/* full-bleed helper: escape the centered container for edge-to-edge bands */
function FullBleed({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative left-1/2 right-1/2 -mx-[50vw] w-screen", className)}>
      <div className="mx-auto max-w-wrap px-5">{children}</div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto mb-10 max-w-2xl text-center">
      <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.2em] text-blue">{eyebrow}</p>
      <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{title}</h2>
      {sub && <p className="mx-auto mt-3 max-w-xl text-muted">{sub}</p>}
    </div>
  );
}

/* ─────────────────────────────── HERO ─────────────────────────────── */

function Hero() {
  return (
    <section className="grid items-center gap-12 pt-6 md:pt-10 lg:grid-cols-[1.05fr_1fr]">
      <div className="animate-pop">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 font-mono text-xs font-semibold text-muted shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Post-quantum · open source · <code className="text-blue">pip install privyq</code>
        </span>
        <h1 className="mt-6 font-display text-[2.7rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
          Data that <span className="ink-hl">protects itself.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          PrivyQ locks your data and the rules for opening it in a single step. Only the right
          person, for the right reason, can decrypt — and every attempt leaves a receipt that
          can’t be forged or quietly erased. Quantum-safe, in three lines of code.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link
            href="/app"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-base font-bold text-white shadow-ink transition-transform hover:-translate-y-0.5"
          >
            Try the live demo <ArrowRight className="h-5 w-5" />
          </Link>
          <CopyInstall />
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-semibold text-muted">
          <Link href="/docs" className="hover:text-ink">Documentation</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 hover:text-ink"><Github className="h-4 w-4" /> GitHub</a>
          <a href={PYPI_URL} target="_blank" rel="noopener" className="hover:text-ink">PyPI</a>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-mint" /> MIT licensed</span>
        </div>
      </div>

      <AccessDemo />
    </section>
  );
}

function CopyInstall() {
  const [copied, setCopied] = React.useState(false);
  return (
    <button
      onClick={async () => {
        try { await navigator.clipboard.writeText("pip install privyq"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {}
      }}
      className="inline-flex items-center gap-3 rounded-full border border-line bg-white px-5 py-3.5 font-mono text-sm shadow-sm transition-colors hover:border-ink"
    >
      <span className="text-muted">$</span> pip install privyq
      {copied ? <Check className="h-4 w-4 text-mint" /> : <Copy className="h-4 w-4 text-muted" />}
    </button>
  );
}

/* The interactive hero visual — a self-contained preview of policy enforcement. */

type Persona = { id: string; name: string; role: string; dept: string; purpose: string; initials: string };
const PERSONAS: Persona[] = [
  { id: "amara", name: "Dr. Amara Okafor", role: "doctor", dept: "cardiology", purpose: "treatment", initials: "AO" },
  { id: "bello", name: "Nurse Bello Musa", role: "nurse", dept: "general", purpose: "admin", initials: "BM" },
  { id: "chen", name: "Riley Chen", role: "researcher", dept: "oncology", purpose: "research", initials: "RC" },
];
const RECORD = "Patient: John D. (58)\nEcho: mild LV hypertrophy. BP 132/84.\nPlan: continue beta-blocker, review in 2 wks.";
const CIPHER = "▓▓▓▓ ▓▓▓▓▓ ▓▓ ▓▓▓▓▓▓▓ ▓▓▓\n▓▓▓▓▓ ▓▓ ▓▓▓▓ ▓▓▓▓▓▓ ▓▓▓▓\n▓▓ ▓▓▓▓▓▓▓ ▓▓▓▓ ▓▓▓ ▓▓▓▓▓";

function AccessDemo() {
  const [pid, setPid] = React.useState("amara");
  const [outcome, setOutcome] = React.useState<null | { granted: boolean; reason: string }>(null);
  const [receipts, setReceipts] = React.useState<{ who: string; ok: boolean; hash: string }[]>([]);
  const [nonce, setNonce] = React.useState(0);
  const persona = PERSONAS.find((p) => p.id === pid)!;

  const request = () => {
    const granted = persona.role === "doctor" && persona.dept === "cardiology" && persona.purpose === "treatment";
    const reason = granted
      ? "all conditions satisfied"
      : persona.role !== "doctor" ? `role is “${persona.role}”, not doctor`
      : persona.dept !== "cardiology" ? `department is “${persona.dept}”` : `purpose is “${persona.purpose}”`;
    setOutcome({ granted, reason });
    setNonce((n) => n + 1);
    const surname = persona.name.split(" ").slice(-1)[0] ?? persona.name;
    setReceipts((r) => [{ who: surname, ok: granted, hash: Math.random().toString(16).slice(2, 8) }, ...r].slice(0, 3));
  };

  const reset = (id: string) => { setPid(id); setOutcome(null); };

  return (
    <div className="animate-pop [animation-delay:120ms]">
      <Card className="overflow-hidden shadow-md">
        {/* window chrome */}
        <div className="flex items-center gap-1.5 border-b border-line bg-tint px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red/50" />
          <span className="h-2.5 w-2.5 rounded-full bg-amber/60" />
          <span className="h-2.5 w-2.5 rounded-full bg-mint/60" />
          <span className="ml-2 font-mono text-xs text-muted">patient_001 · sealed</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted">preview</span>
        </div>

        <CardContent className="flex flex-col gap-4 py-5">
          {/* who's asking */}
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Act as</p>
            <div className="flex gap-2">
              {PERSONAS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => reset(p.id)}
                  className={cn(
                    "flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2 text-center transition-colors",
                    p.id === pid ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink",
                  )}
                >
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold",
                    p.id === pid ? "bg-white/20 text-white" : "avatar-gradient text-white")}>{p.initials}</span>
                  <span className="text-[11px] font-semibold leading-tight">{p.role}</span>
                </button>
              ))}
            </div>
          </div>

          {/* policy chips */}
          <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
            {["role = doctor", "dept = cardiology", "purpose = treatment"].map((c) => (
              <span key={c} className="rounded-full border border-line bg-tint px-2 py-0.5 text-muted">{c}</span>
            ))}
          </div>

          {/* the vault */}
          <div
            key={nonce}
            className={cn(
              "rounded-xl border p-4 transition-colors",
              outcome?.granted ? "border-mint/50 bg-mint/5 animate-pop"
                : outcome ? "border-red/40 bg-red/5 animate-shake" : "border-line bg-ink/[.03]",
            )}
          >
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              {outcome?.granted ? <><LockOpen className="h-4 w-4 text-mint" /> Unlocked</>
                : outcome ? <><ShieldX className="h-4 w-4 text-red" /> Denied</>
                : <><Lock className="h-4 w-4" /> Locked</>}
            </div>
            {outcome?.granted ? (
              <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-ink">{RECORD}</pre>
            ) : outcome ? (
              <p className="text-xs text-red">Access denied — {outcome.reason}. The data stays sealed.</p>
            ) : (
              <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-muted">{CIPHER}</pre>
            )}
          </div>

          <button onClick={request} className="inline-flex items-center justify-center gap-2 rounded-full bg-blue px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5">
            <KeyRound className="h-4 w-4" /> Request access
          </button>

          {/* receipts */}
          {receipts.length > 0 && (
            <div className="border-t border-line pt-3">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Signed receipts</p>
              <ul className="flex flex-col gap-1.5">
                {receipts.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={cn("rounded px-1.5 py-0.5 font-bold", r.ok ? "bg-mint/15 text-[#0a9c6b]" : "bg-red/15 text-[#c62d50]")}>
                      {r.ok ? "GRANTED" : "DENIED"}
                    </span>
                    <span className="text-ink-2">{r.who}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-muted"><Link2 className="h-3 w-3" /> #{r.hash}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-3 text-center text-xs text-muted">
        Illustrative preview. <Link href="/app" className="font-semibold text-blue hover:underline">Run the real thing →</Link>
      </p>
    </div>
  );
}

/* ─────────────────────────── TRUST STRIP ─────────────────────────── */

function TrustStrip() {
  const items = ["ML-KEM (Kyber)", "ML-DSA (Dilithium)", "AES-256-GCM", "SHA-256 receipts", "MIT · on PyPI"];
  return (
    <FullBleed className="border-y border-line bg-white/60 py-6">
      <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-xs font-semibold uppercase tracking-wider text-muted">
        {items.map((t) => <span key={t}>{t}</span>)}
      </div>
    </FullBleed>
  );
}

/* ─────────────────────────── FEATURES ─────────────────────────── */

function Features() {
  return (
    <section className="flex flex-col gap-16">
      <SectionHead
        eyebrow="Why PrivyQ"
        title={<>Encryption answers <span className="ink-hl">“is it secret?”</span><br className="hidden sm:block" /> PrivyQ answers <span className="ink-hl">“who, when, and can you prove it?”</span></>}
      />

      <FeatureRow
        icon={<Lock className="h-6 w-6" />}
        title="The rules live inside the data"
        body="When you encrypt, you attach a policy — role, department, purpose, expiry. Those rules travel inside the ciphertext and are checked before anything unlocks. There's no separate permissions table to misconfigure or bypass."
        visual={<PolicyVisual />}
      />
      <FeatureRow
        reverse
        icon={<ScrollText className="h-6 w-6" />}
        title="Receipts you can actually trust"
        body="Every access — allowed or denied — is signed and linked to the one before it. Edit an entry, delete one, or reorder them and verification fails. It's evidence of compliance, not a log someone can quietly rewrite."
        visual={<ChainVisual />}
      />
      <FeatureRow
        icon={<ShieldCheck className="h-6 w-6" />}
        title="Safe against tomorrow’s computers"
        body="A future quantum computer will break the RSA and elliptic-curve crypto most systems use today. PrivyQ uses the post-quantum algorithms NIST standardized — Kyber and Dilithium — so what you protect now stays private for decades."
        visual={<PqVisual />}
      />
    </section>
  );
}

function FeatureRow({ icon, title, body, visual, reverse }: { icon: React.ReactNode; title: string; body: string; visual: React.ReactNode; reverse?: boolean }) {
  return (
    <div className={cn("grid items-center gap-8 lg:grid-cols-2", reverse && "lg:[&>*:first-child]:order-2")}>
      <div>
        <span className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-blue/10 text-blue">{icon}</span>
        <h3 className="font-display text-2xl font-bold tracking-tight">{title}</h3>
        <p className="mt-3 max-w-md leading-relaxed text-muted">{body}</p>
      </div>
      <div>{visual}</div>
    </div>
  );
}

function PolicyVisual() {
  return (
    <Card className="shadow-sm">
      <CardContent className="py-6">
        <div className="rounded-xl border border-line bg-ink p-4 font-mono text-[12px] text-white/90">
          <p className="text-white/40"># sealed ciphertext</p>
          <p className="text-mint">▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</p>
          <p className="mt-2 text-white/40"># embedded policy</p>
          <p><span className="text-blue">role</span> = doctor</p>
          <p><span className="text-blue">department</span> = cardiology</p>
          <p><span className="text-blue">purpose</span> = treatment</p>
          <p><span className="text-blue">expiry</span> = 24h</p>
        </div>
      </CardContent>
    </Card>
  );
}

function ChainVisual() {
  return (
    <Card className="shadow-sm">
      <CardContent className="flex flex-col gap-2 py-6">
        {[
          { who: "dr_amara", op: "protect", ok: true },
          { who: "dr_amara", op: "access", ok: true },
          { who: "nurse_bello", op: "access", ok: false },
        ].map((r, i) => (
          <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-tint/50 px-3 py-2 font-mono text-[11px]">
            <FileCheck2 className={cn("h-4 w-4", r.ok ? "text-mint" : "text-red")} />
            <span className="font-semibold text-ink-2">{r.who}</span>
            <span className="text-muted">{r.op}</span>
            <span className={cn("ml-auto rounded px-1.5 font-bold", r.ok ? "bg-mint/15 text-[#0a9c6b]" : "bg-red/15 text-[#c62d50]")}>{r.ok ? "granted" : "denied"}</span>
          </div>
        ))}
        <p className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-muted"><Link2 className="h-3 w-3" /> each entry hash-chained to the last · tamper = broken chain</p>
      </CardContent>
    </Card>
  );
}

function PqVisual() {
  return (
    <Card className="shadow-sm">
      <CardContent className="grid gap-3 py-6 sm:grid-cols-2">
        <div className="rounded-xl border border-red/30 bg-red/5 p-4">
          <p className="font-display font-bold text-red">RSA · ECC</p>
          <p className="mt-1 text-xs text-muted">Broken by a quantum computer running Shor’s algorithm.</p>
        </div>
        <div className="rounded-xl border border-mint/40 bg-mint/5 p-4">
          <p className="font-display font-bold text-[#0a9c6b]">Kyber · Dilithium</p>
          <p className="mt-1 text-xs text-muted">Lattice-based, NIST-standardized, quantum-resistant.</p>
        </div>
      </CardContent>
    </Card>
  );
}

/* ─────────────────────────── HOW IT WORKS ─────────────────────────── */

const STEPS = [
  { n: "01", icon: <Lock className="h-5 w-5" />, verb: "protect", line: "Encrypt data with a policy baked in.", code: 'protect(data, {"role": "doctor"})' },
  { n: "02", icon: <KeyRound className="h-5 w-5" />, verb: "access", line: "Decrypt — only if the policy is met.", code: 'access(sealed, {"role": "doctor"})' },
  { n: "03", icon: <FileCheck2 className="h-5 w-5" />, verb: "verify", line: "Prove a receipt is genuine.", code: "verify(receipt)  # → True" },
];

function HowItWorks() {
  return (
    <section>
      <SectionHead eyebrow="How it works" title="Three verbs. That’s the whole API." sub="No cryptography knowledge required — the hard parts stay inside the core." />
      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map((s) => (
          <Card key={s.verb} className="h-full transition-transform hover:-translate-y-1">
            <CardContent className="flex flex-col gap-3 py-6">
              <div className="flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-ink text-white">{s.icon}</span>
                <span className="font-mono text-2xl font-extrabold text-line">{s.n}</span>
              </div>
              <h3 className="font-mono text-lg font-bold text-blue">{s.verb}()</h3>
              <p className="text-sm text-muted">{s.line}</p>
              <pre className="overflow-x-auto rounded-lg bg-tint px-3 py-2 font-mono text-[11px] text-ink-2">{s.code}</pre>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── USE CASES ─────────────────────────── */

const CASES = [
  { icon: <Stethoscope className="h-5 w-5" />, title: "Healthcare", body: "A chart opens for the treating clinician — never the wrong ward — and every look is provable for compliance." },
  { icon: <Landmark className="h-5 w-5" />, title: "Finance", body: "Release statements to auditors only from the right region, for an audit, inside the approved window." },
  { icon: <Scale className="h-5 w-5" />, title: "Legal", body: "Privileged files open only for delegated counsel; revoke the moment someone leaves." },
  { icon: <BrainCircuit className="h-5 w-5" />, title: "AI & data", body: "Bind a dataset to “research only” so it can’t be quietly repurposed — with lineage to prove it." },
];

function UseCases() {
  return (
    <section>
      <SectionHead eyebrow="Where it fits" title="Anywhere “who can open this?” matters" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CASES.map((c) => (
          <Card key={c.title} className="h-full">
            <CardContent className="flex flex-col gap-2.5 py-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-tint text-ink">{c.icon}</span>
              <h3 className="font-display font-bold">{c.title}</h3>
              <p className="text-sm text-muted">{c.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── QUICKSTART ─────────────────────────── */

function Quickstart() {
  return (
    <section className="grid items-center gap-10 lg:grid-cols-[1fr_1.15fr]">
      <div>
        <SectionHead eyebrow="Quickstart" title="From install to encrypted in a minute" />
        <div className="-mt-4 text-center lg:text-left">
          <p className="text-muted">Install from PyPI, point at a core, and you’re protecting data with post-quantum encryption and policy in a handful of lines.</p>
          <div className="mt-5 flex justify-center lg:justify-start"><Link href="/docs" className="inline-flex items-center gap-1.5 font-semibold text-blue hover:underline">Read the full docs <ArrowRight className="h-4 w-4" /></Link></div>
        </div>
      </div>
      <Card className="overflow-hidden shadow-md">
        <div className="flex items-center gap-1.5 border-b border-line bg-tint px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red/50" /><span className="h-2.5 w-2.5 rounded-full bg-amber/60" /><span className="h-2.5 w-2.5 rounded-full bg-mint/60" />
          <span className="ml-2 font-mono text-xs text-muted">quickstart.py</span>
        </div>
        <CardContent className="overflow-x-auto py-4">
          <pre className="font-mono text-[12.5px] leading-relaxed">
{`import privyq
privyq.configure(core_address="localhost:50051")

protected = privyq.protect(
    patient_chart,
    policy={"role": "doctor", "department": "cardiology",
            "purpose": "treatment", "expiry": "24h"},
)

result = privyq.access(protected, identity={"role": "doctor",
    "department": "cardiology", "purpose": "treatment"})
print(result.text)          # decrypted — policy satisfied

privyq.access(protected, identity={"role": "nurse"})
# → PolicyViolationError (and the attempt is logged)`}
          </pre>
        </CardContent>
      </Card>
    </section>
  );
}

/* ─────────────────────────── CTA BAND ─────────────────────────── */

function CtaBand() {
  return (
    <FullBleed>
      <section className="relative overflow-hidden rounded-[32px] bg-ink px-8 py-16 text-center text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-pink/20 blur-3xl" aria-hidden />
        <h2 className="relative mx-auto max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">
          See it work in under a minute
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-white/70">
          Protect a record, then try to open it as different people. Watch the right person get in,
          the wrong one turned away, and the receipts pile up — all live.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link href="/app" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-bold text-ink transition-transform hover:-translate-y-0.5">
            Launch the demo <ArrowRight className="h-5 w-5" />
          </Link>
          <a href={PYPI_URL} target="_blank" rel="noopener" className="rounded-full border border-white/25 px-6 py-3.5 font-bold text-white transition-colors hover:bg-white/10">
            pip install privyq
          </a>
        </div>
      </section>
    </FullBleed>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line pt-8 text-sm text-muted">
      <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
        <p>© 2026 PrivyQ · MIT licensed · post-quantum, end to end.</p>
        <div className="flex items-center gap-5 font-semibold">
          <Link href="/docs" className="hover:text-ink">Docs</Link>
          <Link href="/app" className="hover:text-ink">Demo</Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="hover:text-ink">GitHub</a>
          <a href={PYPI_URL} target="_blank" rel="noopener" className="hover:text-ink">PyPI</a>
        </div>
      </div>
    </footer>
  );
}
