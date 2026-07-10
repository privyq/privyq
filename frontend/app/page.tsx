"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowRight, Lock, LockOpen, ShieldX, ShieldCheck, ScrollText, KeyRound, FileCheck2,
  Link2, Copy, Check, Github, Stethoscope, Landmark, Scale, BrainCircuit, Zap, Server,
  Package, Terminal, Plus, X, Minus,
} from "lucide-react";
import { GITHUB_URL, PYPI_URL } from "@/components/site-header";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

/* PrivyQ commercial landing page. */

export default function Landing() {
  return (
    <div className="flex flex-col gap-28 pb-24">
      <Hero />
      <Stats />
      <Problem />
      <Features />
      <HowItWorks />
      <Comparison />
      <UseCases />
      <OpenSource />
      <Faq />
      <FinalCta />
      <Footer />
    </div>
  );
}

/* full-bleed helper so bands go edge-to-edge (body has overflow-x: clip) */
function FullBleed({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("relative left-1/2 right-1/2 -mx-[50vw] w-screen", className)}>
      <div className="mx-auto max-w-wrap px-5">{children}</div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: React.ReactNode; sub?: string }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.22em] text-blue">{eyebrow}</p>
      <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.6rem]">{title}</h2>
      {sub && <p className="mx-auto mt-4 max-w-xl text-lg text-muted">{sub}</p>}
    </div>
  );
}

/* ───────────────────────────────── HERO ───────────────────────────────── */

function Hero() {
  return (
    <section className="grid items-center gap-12 pt-6 md:pt-12 lg:grid-cols-[1.05fr_1fr]">
      <div className="animate-pop">
        <span className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1.5 font-mono text-xs font-semibold text-muted shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-mint" /> Post-quantum encryption for developers
        </span>
        <h1 className="mt-6 font-display text-[2.75rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl">
          Data that <span className="ink-hl">protects itself.</span>
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted">
          PrivyQ locks your data and the rules for opening it in one step. Only the right person,
          for the right reason, can decrypt — and every attempt leaves a receipt that can’t be
          forged or quietly erased. Quantum-safe, in three lines of code.
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/app" className="inline-flex items-center justify-center gap-2 rounded-full bg-ink px-6 py-3.5 text-base font-bold text-white shadow-ink transition-transform hover:-translate-y-0.5">
            Try the live demo <ArrowRight className="h-5 w-5" />
          </Link>
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="inline-flex items-center justify-center gap-2 rounded-full border-[1.5px] border-line bg-white px-6 py-3.5 text-base font-bold text-ink transition-colors hover:border-ink">
            <Github className="h-5 w-5" /> Star on GitHub
          </a>
        </div>
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
          <CopyInstall />
          <span className="inline-flex items-center gap-1.5 font-semibold text-muted"><ShieldCheck className="h-4 w-4 text-mint" /> MIT · open source · on PyPI</span>
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
      onClick={async () => { try { await navigator.clipboard.writeText("pip install privyq"); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch {} }}
      className="inline-flex items-center gap-2.5 rounded-full border border-line bg-white px-4 py-2 font-mono text-sm shadow-sm transition-colors hover:border-ink"
    >
      <span className="text-muted">$</span> pip install privyq
      {copied ? <Check className="h-4 w-4 text-mint" /> : <Copy className="h-4 w-4 text-muted" />}
    </button>
  );
}

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
    const reason = granted ? "all conditions satisfied"
      : persona.role !== "doctor" ? `role is “${persona.role}”, not doctor`
      : persona.dept !== "cardiology" ? `department is “${persona.dept}”` : `purpose is “${persona.purpose}”`;
    setOutcome({ granted, reason }); setNonce((n) => n + 1);
    const surname = persona.name.split(" ").slice(-1)[0] ?? persona.name;
    setReceipts((r) => [{ who: surname, ok: granted, hash: Math.random().toString(16).slice(2, 8) }, ...r].slice(0, 3));
  };

  return (
    <div className="animate-pop [animation-delay:120ms]">
      <Card className="overflow-hidden shadow-md">
        <div className="flex items-center gap-1.5 border-b border-line bg-tint px-4 py-2.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red/50" /><span className="h-2.5 w-2.5 rounded-full bg-amber/60" /><span className="h-2.5 w-2.5 rounded-full bg-mint/60" />
          <span className="ml-2 font-mono text-xs text-muted">patient_001 · sealed</span>
          <span className="ml-auto font-mono text-[10px] uppercase tracking-widest text-muted">live preview</span>
        </div>
        <CardContent className="flex flex-col gap-4 py-5">
          <div>
            <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Act as</p>
            <div className="flex gap-2">
              {PERSONAS.map((p) => (
                <button key={p.id} onClick={() => { setPid(p.id); setOutcome(null); }}
                  className={cn("flex flex-1 flex-col items-center gap-1 rounded-xl border px-2 py-2 transition-colors",
                    p.id === pid ? "border-ink bg-ink text-white" : "border-line bg-white hover:border-ink")}>
                  <span className={cn("grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold", p.id === pid ? "bg-white/20 text-white" : "avatar-gradient text-white")}>{p.initials}</span>
                  <span className="text-[11px] font-semibold">{p.role}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 font-mono text-[10.5px]">
            {["role = doctor", "dept = cardiology", "purpose = treatment"].map((c) => (
              <span key={c} className="rounded-full border border-line bg-tint px-2 py-0.5 text-muted">{c}</span>
            ))}
          </div>
          <div key={nonce} className={cn("rounded-xl border p-4 transition-colors",
            outcome?.granted ? "border-mint/50 bg-mint/5 animate-pop" : outcome ? "border-red/40 bg-red/5 animate-shake" : "border-line bg-ink/[.03]")}>
            <div className="mb-2 flex items-center gap-2 text-sm font-bold">
              {outcome?.granted ? <><LockOpen className="h-4 w-4 text-mint" /> Unlocked</> : outcome ? <><ShieldX className="h-4 w-4 text-red" /> Denied</> : <><Lock className="h-4 w-4" /> Locked</>}
            </div>
            {outcome?.granted ? <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-ink">{RECORD}</pre>
              : outcome ? <p className="text-xs text-red">Access denied — {outcome.reason}. The data stays sealed.</p>
              : <pre className="whitespace-pre-wrap font-mono text-[11.5px] leading-relaxed text-muted">{CIPHER}</pre>}
          </div>
          <button onClick={request} className="inline-flex items-center justify-center gap-2 rounded-full bg-blue px-4 py-2.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5">
            <KeyRound className="h-4 w-4" /> Request access
          </button>
          {receipts.length > 0 && (
            <div className="border-t border-line pt-3">
              <p className="mb-2 font-mono text-[11px] uppercase tracking-wider text-muted">Signed receipts</p>
              <ul className="flex flex-col gap-1.5">
                {receipts.map((r, i) => (
                  <li key={i} className="flex items-center gap-2 font-mono text-[11px]">
                    <span className={cn("rounded px-1.5 py-0.5 font-bold", r.ok ? "bg-mint/15 text-[#0a9c6b]" : "bg-red/15 text-[#c62d50]")}>{r.ok ? "GRANTED" : "DENIED"}</span>
                    <span className="text-ink-2">{r.who}</span>
                    <span className="ml-auto inline-flex items-center gap-1 text-muted"><Link2 className="h-3 w-3" /> #{r.hash}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>
      <p className="mt-3 text-center text-xs text-muted">This is a live preview. <Link href="/app" className="font-semibold text-blue hover:underline">Run the real thing →</Link></p>
    </div>
  );
}

/* ───────────────────────────────── STATS ───────────────────────────────── */

function Stats() {
  const items = [
    ["< 1 ms", "every protect & access"],
    ["3 verbs", "protect · access · verify"],
    ["100%", "post-quantum key exchange"],
    ["MIT", "free & open source"],
  ];
  return (
    <FullBleed className="border-y border-line bg-white/60 py-10">
      <div className="grid grid-cols-2 gap-8 text-center lg:grid-cols-4">
        {items.map(([n, l]) => (
          <div key={l}>
            <p className="font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{n}</p>
            <p className="mt-1 text-sm text-muted">{l}</p>
          </div>
        ))}
      </div>
    </FullBleed>
  );
}

/* ─────────────────────────────── PROBLEM ─────────────────────────────── */

function Problem() {
  return (
    <section className="mx-auto max-w-3xl text-center">
      <p className="mb-2 font-mono text-xs font-bold uppercase tracking-[0.22em] text-blue">The gap</p>
      <h2 className="font-display text-3xl font-extrabold leading-tight tracking-tight sm:text-[2.6rem]">
        Encryption answers <span className="ink-hl">“is it secret?”</span>
      </h2>
      <p className="mx-auto mt-5 max-w-2xl text-lg text-muted">
        It says nothing about <strong className="text-ink">who</strong> may open your data,{" "}
        <strong className="text-ink">under what conditions</strong>, or how you{" "}
        <strong className="text-ink">prove</strong> access followed the rules. And the crypto most
        systems use today won’t survive a quantum computer. PrivyQ closes all three gaps at once.
      </p>
    </section>
  );
}

/* ─────────────────────────────── FEATURES ─────────────────────────────── */

function Features() {
  return (
    <section className="flex flex-col gap-16">
      <FeatureRow icon={<Lock className="h-6 w-6" />} title="The rules live inside the data"
        body="When you encrypt, you attach a policy — role, department, purpose, expiry. Those rules travel inside the ciphertext and are checked before anything unlocks. There’s no separate permissions table to misconfigure or bypass."
        visual={<PolicyVisual />} />
      <FeatureRow reverse icon={<ScrollText className="h-6 w-6" />} title="Receipts you can actually trust"
        body="Every access — allowed or denied — is signed and linked to the one before it. Edit an entry, delete one, or reorder them and verification fails. It’s evidence of compliance, not a log someone can quietly rewrite."
        visual={<ChainVisual />} />
      <FeatureRow icon={<ShieldCheck className="h-6 w-6" />} title="Safe against tomorrow’s computers"
        body="A future quantum computer will break the RSA and elliptic-curve crypto most systems use today. PrivyQ uses the post-quantum algorithms NIST standardized — Kyber and Dilithium — so what you protect now stays private for decades."
        visual={<PqVisual />} />
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
    <Card className="shadow-sm"><CardContent className="py-6">
      <div className="rounded-xl border border-line bg-ink p-4 font-mono text-[12px] text-white/90">
        <p className="text-white/40"># sealed ciphertext</p>
        <p className="text-mint">▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓</p>
        <p className="mt-2 text-white/40"># embedded policy</p>
        <p><span className="text-blue">role</span> = doctor</p>
        <p><span className="text-blue">department</span> = cardiology</p>
        <p><span className="text-blue">purpose</span> = treatment</p>
        <p><span className="text-blue">expiry</span> = 24h</p>
      </div>
    </CardContent></Card>
  );
}

function ChainVisual() {
  return (
    <Card className="shadow-sm"><CardContent className="flex flex-col gap-2 py-6">
      {[{ who: "dr_amara", op: "protect", ok: true }, { who: "dr_amara", op: "access", ok: true }, { who: "nurse_bello", op: "access", ok: false }].map((r, i) => (
        <div key={i} className="flex items-center gap-2 rounded-lg border border-line bg-tint/50 px-3 py-2 font-mono text-[11px]">
          <FileCheck2 className={cn("h-4 w-4", r.ok ? "text-mint" : "text-red")} />
          <span className="font-semibold text-ink-2">{r.who}</span><span className="text-muted">{r.op}</span>
          <span className={cn("ml-auto rounded px-1.5 font-bold", r.ok ? "bg-mint/15 text-[#0a9c6b]" : "bg-red/15 text-[#c62d50]")}>{r.ok ? "granted" : "denied"}</span>
        </div>
      ))}
      <p className="mt-1 flex items-center gap-1.5 font-mono text-[10.5px] text-muted"><Link2 className="h-3 w-3" /> each entry hash-chained to the last · tamper = broken chain</p>
    </CardContent></Card>
  );
}

function PqVisual() {
  return (
    <Card className="shadow-sm"><CardContent className="grid gap-3 py-6 sm:grid-cols-2">
      <div className="rounded-xl border border-red/30 bg-red/5 p-4"><p className="font-display font-bold text-red">RSA · ECC</p><p className="mt-1 text-xs text-muted">Broken by a quantum computer running Shor’s algorithm.</p></div>
      <div className="rounded-xl border border-mint/40 bg-mint/5 p-4"><p className="font-display font-bold text-[#0a9c6b]">Kyber · Dilithium</p><p className="mt-1 text-xs text-muted">Lattice-based, NIST-standardized, quantum-resistant.</p></div>
    </CardContent></Card>
  );
}

/* ─────────────────────────────── HOW IT WORKS ─────────────────────────────── */

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
      <p className="mt-6 text-center"><Link href="/docs" className="inline-flex items-center gap-1.5 font-semibold text-blue hover:underline">Read the full docs <ArrowRight className="h-4 w-4" /></Link></p>
    </section>
  );
}

/* ─────────────────────────────── COMPARISON ─────────────────────────────── */

const CMP_ROWS: [string, number, number, number][] = [
  // 2 = yes, 1 = partial, 0 = no
  ["Quantum-safe (post-quantum)", 0, 1, 2],
  ["Access policy travels with the data", 0, 2, 2],
  ["Policy enforced before decryption", 0, 2, 2],
  ["Tamper-evident audit trail built in", 0, 0, 2],
  ["No central attribute authority needed", 2, 0, 2],
  ["Three-line developer API", 1, 0, 2],
];

function Mark({ v }: { v: number }) {
  if (v === 2) return <Check className="mx-auto h-5 w-5 text-mint" />;
  if (v === 1) return <Minus className="mx-auto h-5 w-5 text-amber" />;
  return <X className="mx-auto h-5 w-5 text-line" />;
}

function Comparison() {
  return (
    <section>
      <SectionHead eyebrow="How it compares" title="More than encryption. More than access control." />
      <Card className="overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead>
              <tr className="border-b border-line">
                <th className="px-4 py-4 text-left font-semibold text-muted">Capability</th>
                <th className="px-4 py-4 text-center font-semibold text-muted">Classic<br /><span className="font-normal">AES / RSA</span></th>
                <th className="px-4 py-4 text-center font-semibold text-muted">ABE<br /><span className="font-normal">attribute-based</span></th>
                <th className="px-4 py-4 text-center font-bold text-blue">PrivyQ</th>
              </tr>
            </thead>
            <tbody>
              {CMP_ROWS.map(([label, a, b, c], i) => (
                <tr key={i} className={cn("border-b border-line", i % 2 && "bg-tint/40")}>
                  <td className="px-4 py-3 font-medium">{label}</td>
                  <td className="px-4 py-3"><Mark v={a} /></td>
                  <td className="px-4 py-3"><Mark v={b} /></td>
                  <td className="bg-blue/[.04] px-4 py-3"><Mark v={c} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-center text-xs text-muted">
        <Check className="inline h-3.5 w-3.5 text-mint" /> yes &nbsp;·&nbsp;
        <Minus className="inline h-3.5 w-3.5 text-amber" /> partial &nbsp;·&nbsp;
        <X className="inline h-3.5 w-3.5 text-line" /> no
      </p>
    </section>
  );
}

/* ─────────────────────────────── USE CASES ─────────────────────────────── */

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
          <Card key={c.title} className="h-full"><CardContent className="flex flex-col gap-2.5 py-5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-tint text-ink">{c.icon}</span>
            <h3 className="font-display font-bold">{c.title}</h3>
            <p className="text-sm text-muted">{c.body}</p>
          </CardContent></Card>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────── OPEN SOURCE ("PRICING") ─────────────────────────── */

function OpenSource() {
  const cols = [
    { icon: <Package className="h-5 w-5" />, h: "Free forever", p: "MIT-licensed. No seats, no tiers, no usage fees. pip install privyq and go." },
    { icon: <Github className="h-5 w-5" />, h: "Fully open source", p: "Every line is public and auditable — the way security software should be." },
    { icon: <Server className="h-5 w-5" />, h: "Self-hosted", p: "Runs on your infrastructure with make dev. Your keys, your data, no lock-in." },
  ];
  return (
    <FullBleed>
      <section className="rounded-[32px] border border-line bg-white/70 px-6 py-14 sm:px-12">
        <SectionHead eyebrow="Pricing" title="Free. Open source. Yours." sub="PrivyQ is built in the open and free to use in production. No catch." />
        <div className="grid gap-4 sm:grid-cols-3">
          {cols.map((c) => (
            <div key={c.h} className="rounded-2xl border border-line bg-paper p-6 text-center">
              <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-blue/10 text-blue">{c.icon}</span>
              <h3 className="font-display text-lg font-bold">{c.h}</h3>
              <p className="mt-2 text-sm text-muted">{c.p}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a href={PYPI_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 font-bold text-white transition-transform hover:-translate-y-0.5"><Terminal className="h-4 w-4" /> pip install privyq</a>
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="inline-flex items-center gap-2 rounded-full border-[1.5px] border-line bg-white px-6 py-3 font-bold text-ink transition-colors hover:border-ink"><Github className="h-4 w-4" /> View source</a>
        </div>
      </section>
    </FullBleed>
  );
}

/* ─────────────────────────────── FAQ ─────────────────────────────── */

const FAQS = [
  ["What is post-quantum cryptography?", "It’s cryptography designed to resist attack by quantum computers. A future quantum computer could break RSA and elliptic-curve crypto; PrivyQ instead uses lattice-based algorithms (Kyber and Dilithium) that NIST standardized in 2024, which resist both classical and quantum attacks."],
  ["Does PrivyQ replace TLS?", "No — it complements it. TLS protects data in transit between machines. PrivyQ protects data at rest and in use, and adds policy enforcement and a verifiable audit trail. You’d typically run both."],
  ["What algorithms does it use?", "Hybrid encryption with ML-KEM (Kyber-768) for the key exchange and AES-256-GCM for the data, ML-DSA (Dilithium-3) signatures for the audit trail, and SHA-256 for the hash chain — all standardized and widely reviewed."],
  ["How is the audit log tamper-proof?", "Every entry is digitally signed and stores the hash of the previous entry. Editing a field breaks its signature; deleting or reordering entries breaks the chain. Verification catches all of it, so the log is evidence, not just a record."],
  ["Is it production-ready?", "The full stack runs end to end and the SDK is published on PyPI. It ships a development key store out of the box; for production you’d point it at a hardware security module or cloud KMS (the interface is built in)."],
  ["Is it really free?", "Yes. PrivyQ is MIT-licensed and open source. Install it, self-host it, and use it in production at no cost."],
];

function Faq() {
  return (
    <section className="mx-auto max-w-3xl">
      <SectionHead eyebrow="FAQ" title="Questions, answered" />
      <div className="flex flex-col gap-3">
        {FAQS.map(([q, a]) => (
          <details key={q} className="group rounded-2xl border border-line bg-white px-5 py-4 shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
              {q}
              <Plus className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-45" />
            </summary>
            <p className="mt-3 leading-relaxed text-muted">{a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/* ─────────────────────────────── FINAL CTA ─────────────────────────────── */

function FinalCta() {
  return (
    <FullBleed>
      <section className="relative overflow-hidden rounded-[32px] bg-ink px-8 py-16 text-center text-white">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-blue/25 blur-3xl" aria-hidden />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-pink/20 blur-3xl" aria-hidden />
        <div className="relative">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 px-3 py-1.5 font-mono text-xs font-semibold text-white/70"><Zap className="h-3.5 w-3.5" /> Ready in under a minute</span>
          <h2 className="mx-auto mt-5 max-w-2xl font-display text-3xl font-extrabold tracking-tight sm:text-4xl">Give your data rules it can’t forget.</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/70">Protect a record, then try to open it as different people. Watch the right person get in, the wrong one turned away, and the receipts pile up — all live.</p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href="/app" className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 font-bold text-ink transition-transform hover:-translate-y-0.5">Launch the demo <ArrowRight className="h-5 w-5" /></Link>
            <Link href="/docs" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-6 py-3.5 font-bold text-white transition-colors hover:bg-white/10">Read the docs</Link>
          </div>
        </div>
      </section>
    </FullBleed>
  );
}

function Footer() {
  const cols = [
    { h: "Product", links: [["Live demo", "/app"], ["Documentation", "/docs"]] as [string, string][] },
    { h: "Resources", links: [["GitHub", GITHUB_URL], ["PyPI", PYPI_URL]] as [string, string][] },
  ];
  const ext = (href: string) => href.startsWith("http");
  return (
    <footer className="border-t border-line pt-12">
      <div className="grid gap-8 sm:grid-cols-[1.5fr_1fr_1fr]">
        <div>
          <p className="font-display text-lg font-extrabold">PrivyQ</p>
          <p className="mt-2 max-w-xs text-sm text-muted">Post-quantum encryption that carries its own access rules and hands you tamper-proof receipts. Lock it. Rule it. Prove it.</p>
        </div>
        {cols.map((c) => (
          <div key={c.h}>
            <p className="mb-3 font-mono text-xs font-bold uppercase tracking-wider text-muted">{c.h}</p>
            <ul className="flex flex-col gap-2 text-sm font-semibold">
              {c.links.map(([label, href]) => (
                <li key={label}>
                  {ext(href)
                    ? <a href={href} target="_blank" rel="noopener" className="text-ink-2 hover:text-blue">{label}</a>
                    : <Link href={href} className="text-ink-2 hover:text-blue">{label}</Link>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-line py-6 text-sm text-muted sm:flex-row">
        <p>© 2026 PrivyQ · MIT licensed</p>
        <p className="font-mono text-xs">post-quantum, end to end.</p>
      </div>
    </footer>
  );
}
