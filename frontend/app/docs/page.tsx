"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BookOpen,
  Boxes,
  KeyRound,
  Lock,
  Package,
  Play,
  ScrollText,
  ShieldCheck,
  Terminal,
  TriangleAlert,
} from "lucide-react";
import { PageHeading } from "@/components/page-heading";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeBlock, Code } from "@/components/doc-code";
import { cn } from "@/lib/utils";

const GITHUB_URL = "https://github.com/privyq/privyq";
const PYPI_URL = "https://pypi.org/project/privyq/";

type SectionMeta = { id: string; label: string; icon: React.ComponentType<{ className?: string }> };

const SECTIONS: SectionMeta[] = [
  { id: "overview", label: "Overview", icon: BookOpen },
  { id: "quickstart", label: "Install & quickstart", icon: Package },
  { id: "concepts", label: "Core concepts", icon: Lock },
  { id: "policies", label: "Writing policies", icon: ScrollText },
  { id: "sdk", label: "SDK reference", icon: Terminal },
  { id: "rest", label: "REST API", icon: Boxes },
  { id: "running", label: "Running it", icon: Play },
  { id: "architecture", label: "Architecture", icon: KeyRound },
  { id: "security", label: "Security & limits", icon: ShieldCheck },
];

// ─────────────────────────── Code samples ───────────────────────────

const QUICKSTART = `import privyq

privyq.configure(core_address="localhost:50051")

# 1. PROTECT — encrypt a record and embed its access rules in one call.
protected = privyq.protect(
    "Patient: John Doe. Plan: continue beta-blocker.",
    policy={
        "role": "doctor",
        "department": ["cardiology", "oncology"],
        "purpose": "treatment",
        "expiry": "24h",
    },
    actor={"user_id": "dr_smith", "role": "doctor", "department": "cardiology"},
)

# 2. ACCESS — decrypt only if the caller's identity satisfies the policy.
result = privyq.access(
    protected,
    identity={"role": "doctor", "department": "cardiology", "purpose": "treatment"},
)
print(result.text)         # -> "Patient: John Doe. ..."
print(result.receipt.id)   # a signed, verifiable access receipt

# 3. VERIFY — check the receipt's signature and hash-chain linkage.
check = privyq.verify(result.receipt)
assert check.ok and check.signature_valid and check.chain_valid`;

const DENIED = `try:
    privyq.access(protected, identity={"role": "nurse"})
except privyq.PolicyViolationError as why:
    print(why)   # -> "policy violation: role condition failed ..."
    # The denied attempt is still written to the tamper-evident audit chain.`;

const POLICY_SHORTHAND = `{
    "role": "doctor",
    "department": ["cardiology", "oncology"],   # list  -> "in"
    "purpose": "treatment",
    "expiry": "24h"                             # -> "before" (absolute timestamp)
}`;

const POLICY_STRUCTURED = `{
    "conditions": [
        {"type": "role", "operator": "equals", "value": "doctor"},
        {"type": "department", "operator": "in", "value": ["cardiology", "oncology"]},
        {"type": "expiry", "operator": "before", "value": "2026-07-11T00:00:00Z"}
    ],
    "combination": "all"   # "all" (AND) or "any" (OR)
}`;

const POLICY_EX_TIME = `{
    "conditions": [
        {"type": "purpose", "operator": "one_of", "value": ["treatment", "emergency"]},
        {"type": "time_of_day", "operator": "between", "value": ["08:00", "18:00"]},
        {"type": "jurisdiction", "operator": "equals", "value": "EU"}
    ],
    "combination": "all"
}`;

const SDK_CONFIGURE = `privyq.configure(
    core_address="localhost:50051",  # or PRIVYQ_CORE_ADDRESS
    algorithm="kyber_768",           # ML-KEM parameter set
    signature="dilithium_3",         # ML-DSA parameter set
    timeout=5,
    audit=True,
)`;

const SDK_KEYS = `key = privyq.generate_key(type="encryption", algorithm="kyber_768", owner="dr_smith")
privyq.rotate_key(key.id)   # mints a successor; old key retained for existing data
privyq.revoke_key(key.id)   # cuts off all future access`;

const SDK_EVIDENCE = `receipts = privyq.evidence.log(resource_id="rec_123", actor_id="dr_smith")
for r in receipts:
    print(r.timestamp, r.decision, r.hash)`;

const CURL_PROTECT = `curl -s http://localhost:8000/api/v1/protect \\
  -H 'content-type: application/json' \\
  -d '{
    "data": "UGF0aWVudDogSm9obiBEb2U=",           # base64 of the plaintext
    "policy": {"role": "doctor", "department": "cardiology"},
    "actor": {"user_id": "dr_smith", "role": "doctor"}
  }'
# -> { "protected_data": "<base64 ciphertext>", "metadata": {...}, "evidence": {...} }`;

const CURL_ACCESS = `curl -s http://localhost:8000/api/v1/access \\
  -H 'content-type: application/json' \\
  -d '{
    "protected_data": "<base64 ciphertext from /protect>",
    "identity": {"role": "doctor", "department": "cardiology", "purpose": "treatment"}
  }'
# 200 -> { "data": "<base64 plaintext>", "audit_evidence": {...} }
# 403 -> policy violation (still recorded as evidence)`;

const RUN_MAKE = `make dev        # docker-compose: core + gateway + frontend + postgres
# gateway:  http://localhost:8000/docs
# frontend: http://localhost:3000
make down       # stop the stack`;

const RUN_COMPONENTS = `# Go core (all crypto, policy, audit, keys) — in-memory key store for dev
cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd     # :50051 (gRPC)

# FastAPI gateway (REST facade over the SDK)
cd gateway && uvicorn app.main:app --reload               # :8000

# Next.js frontend (this app)
cd frontend && npm run dev                                 # :3000`;

// ─────────────────────────── Data tables ───────────────────────────

const CONDITION_TYPES = [
  ["role", "The caller's role", "equals, not_equals, in, one_of"],
  ["department", "Organisational unit", "equals, in, one_of"],
  ["purpose", "Reason for access", "equals, in, one_of"],
  ["classification", "Data sensitivity label", "equals, in, gte, lte"],
  ["expiry", "Hard cut-off time", "before"],
  ["valid_from / valid_until", "Validity window", "after / before"],
  ["jurisdiction", "Legal region", "equals, in, one_of"],
  ["organization", "Owning organisation", "equals, in"],
  ["location", "Geographic location", "equals, in, one_of"],
  ["time_of_day", "Wall-clock window", "between, after, before"],
];

const OPERATORS = [
  ["equals", "not_equals"],
  ["in", "one_of"],
  ["before", "after"],
  ["between"],
  ["gt", "gte"],
  ["lt", "lte"],
];

const SDK_FUNCS = [
  ["configure(**opts)", "Set the core address, default algorithms, timeout and TLS."],
  ["protect(data, policy, *, actor, key_id, algorithm)", "Encrypt data with an embedded access policy."],
  ["access(protected, identity, *, context)", "Decrypt if the policy is satisfied; otherwise raise PolicyViolationError."],
  ["verify(receipt)", "Verify a receipt's Dilithium signature and hash-chain linkage."],
  ["evidence.log(*, resource_id, actor_id, ...)", "Retrieve audit receipts for a resource or actor."],
  ["generate_key / rotate_key / revoke_key", "Post-quantum key lifecycle management."],
];

const EXCEPTIONS = [
  ["PrivyQError", "Root of the exception hierarchy — catch to handle everything."],
  ["PolicyViolationError", "Access denied — the identity failed the embedded policy (still audited)."],
  ["KeyNotFoundError", "The referenced key does not exist or was revoked."],
  ["CryptoError", "Encryption, decryption or signature verification failed."],
  ["CoreUnreachableError", "The core (privyqd) could not be reached over gRPC."],
];

const ENV_VARS = [
  ["PRIVYQ_CORE_ADDRESS", "localhost:50051", "gRPC address of the Go core."],
  ["PRIVYQ_ALGORITHM", "kyber_768", "Default ML-KEM parameter set."],
  ["PRIVYQ_SIGNATURE", "dilithium_3", "Default ML-DSA signature parameter set."],
  ["PRIVYQ_TIMEOUT", "5", "gRPC call timeout, in seconds."],
  ["PRIVYQ_AUDIT", "true", "Whether to write audit evidence."],
];

const ENDPOINTS = [
  ["POST", "/api/v1/protect", "Encrypt data with an embedded policy."],
  ["POST", "/api/v1/access", "Decrypt when the identity satisfies the policy."],
  ["POST", "/api/v1/verify", "Verify a receipt's signature and chain."],
  ["GET", "/api/v1/evidence/log", "Query the tamper-evident audit chain."],
  ["GET", "/api/v1/keys", "List managed keys."],
  ["POST", "/api/v1/keys/generate", "Mint a new post-quantum key pair."],
  ["POST", "/api/v1/keys/rotate/{id}", "Rotate a key (successor minted, old retained)."],
  ["POST", "/api/v1/keys/revoke/{id}", "Revoke a key and cut off access."],
  ["POST", "/api/v1/policy/evaluate", "Dry-run a policy against an identity (no I/O)."],
  ["GET", "/api/v1/health", "Liveness probe for the gateway and core."],
];

// ─────────────────────────── Small building blocks ───────────────────────────

function SectionHeading({ id, eyebrow, title }: { id: string; eyebrow: string; title: string }) {
  return (
    <div className="mb-4 border-b border-line pb-3">
      <p className="mb-1 font-mono text-[.68rem] uppercase tracking-widest text-blue">{eyebrow}</p>
      <h2 className="scroll-mt-24 font-display text-2xl font-bold tracking-tight md:text-[1.7rem]" id={`${id}-title`}>
        {title}
      </h2>
    </div>
  );
}

function Callout({
  tone = "blue",
  icon: Icon,
  children,
}: {
  tone?: "blue" | "amber" | "mint";
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  const tones = {
    blue: "border-blue/30 bg-blue/[.06] text-ink-2",
    amber: "border-amber/40 bg-amber/[.08] text-ink-2",
    mint: "border-mint/40 bg-mint/[.07] text-ink-2",
  } as const;
  const iconTone = { blue: "text-blue", amber: "text-[#a76a00]", mint: "text-[#0a9c6b]" } as const;
  return (
    <div className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", tones[tone])}>
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", iconTone[tone])} />
      <div className="[&>a]:font-semibold [&>a]:text-blue [&>a]:underline">{children}</div>
    </div>
  );
}

function DataTable({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="scroll-thin overflow-x-auto rounded-lg border border-line">
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-line bg-tint/60">
            {head.map((h) => (
              <th key={h} className="px-4 py-2.5 font-mono text-[.68rem] font-semibold uppercase tracking-widest text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-line/70 last:border-0 hover:bg-tint/40">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-2.5 align-top text-ink-2">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─────────────────────────── Sidebar ───────────────────────────

function Sidebar({ active }: { active: string }) {
  return (
    <nav aria-label="On this page" className="flex flex-col gap-1">
      <p className="mb-2 px-3 font-mono text-[.66rem] font-semibold uppercase tracking-widest text-muted">
        On this page
      </p>
      {SECTIONS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <a
            key={id}
            href={`#${id}`}
            aria-current={isActive ? "location" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-semibold transition-colors",
              isActive ? "bg-ink text-white" : "text-muted hover:bg-tint hover:text-ink",
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-white" : "text-blue/70 group-hover:text-blue")} />
            {label}
          </a>
        );
      })}
      <div className="mt-4 flex flex-col gap-1.5 border-t border-line px-3 pt-4">
        <a href={PYPI_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          PyPI <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        <a href={GITHUB_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink">
          GitHub <ArrowUpRight className="h-3.5 w-3.5" />
        </a>
        <Link href="/playground" className="flex items-center gap-1.5 text-sm font-semibold text-blue hover:underline">
          Try the playground <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </nav>
  );
}

// ─────────────────────────── Page ───────────────────────────

export default function DocsPage() {
  const [active, setActive] = React.useState<string>("overview");

  React.useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -60% 0px", threshold: 0 },
    );
    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div>
      <PageHeading
        eyebrow="Documentation"
        title="Build with PrivyQ"
        description="Policy-governed, post-quantum encryption in three verbs — protect, access, verify. Lock it. Rule it. Prove it."
      >
        <Badge variant="blue">v1.0</Badge>
      </PageHeading>

      <div className="grid gap-10 lg:grid-cols-[220px_1fr]">
        {/* Sidebar */}
        <aside className="lg:sticky lg:top-20 lg:h-max lg:self-start">
          <Sidebar active={active} />
        </aside>

        {/* Content */}
        <div className="flex min-w-0 flex-col gap-16">
          {/* 1. OVERVIEW */}
          <section id="overview" className="scroll-mt-24">
            <SectionHeading id="overview" eyebrow="Start here" title="Overview" />
            <div className="flex flex-col gap-4 text-[.95rem] leading-relaxed text-ink-2">
              <p>
                PrivyQ makes a piece of data carry its own rules. Instead of encrypting first and hoping some
                separate system enforces who may read it, you attach the access policy at the moment of encryption —
                so the rules travel with the ciphertext wherever it goes.
              </p>
              <p>It does exactly three things:</p>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { verb: "protect", icon: Lock, desc: "Encrypt data and embed the access policy in the same call." },
                  { verb: "access", icon: KeyRound, desc: "Decrypt only when the caller's identity satisfies the policy." },
                  { verb: "verify", icon: ShieldCheck, desc: "Prove an access happened with a signed, tamper-evident receipt." },
                ].map(({ verb, icon: Icon, desc }) => (
                  <Card key={verb} className="bg-white/70">
                    <CardContent className="flex flex-col gap-2 p-4">
                      <div className="flex items-center gap-2">
                        <span className="grid h-8 w-8 place-items-center rounded-lg bg-ink text-white">
                          <Icon className="h-4 w-4" />
                        </span>
                        <code className="font-mono text-sm font-semibold text-ink">{verb}()</code>
                      </div>
                      <p className="text-sm text-muted">{desc}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <p>
                Every decision — granted or denied — is recorded as a SHA-256 hash-chained receipt, so you always have
                cryptographic proof of who accessed what, when, and whether they were allowed to.
              </p>
            </div>
          </section>

          {/* 2. QUICKSTART */}
          <section id="quickstart" className="scroll-mt-24">
            <SectionHeading id="quickstart" eyebrow="Get running" title="Install & quickstart" />
            <div className="flex flex-col gap-4">
              <p className="text-[.95rem] leading-relaxed text-ink-2">
                Install the SDK from PyPI. It is a thin Python client that talks to a running PrivyQ core over gRPC.
              </p>
              <CodeBlock lang="bash" code="pip install privyq" />
              <Callout tone="amber" icon={TriangleAlert}>
                The SDK needs a running core. Start the full stack with <Code>make dev</Code> (see{" "}
                <a href="#running">Running it</a>), then point the SDK at it with{" "}
                <Code>configure(core_address=&quot;localhost:50051&quot;)</Code>.
              </Callout>
              <p className="text-[.95rem] leading-relaxed text-ink-2">
                A complete protect → access → verify round-trip:
              </p>
              <CodeBlock lang="python" title="quickstart.py" code={QUICKSTART} />
              <p className="text-[.95rem] leading-relaxed text-ink-2">
                A denied access raises <Code>PolicyViolationError</Code> — but the attempt is still audited, so
                you keep a record of the refusal:
              </p>
              <CodeBlock lang="python" code={DENIED} />
            </div>
          </section>

          {/* 3. CONCEPTS */}
          <section id="concepts" className="scroll-mt-24">
            <SectionHeading id="concepts" eyebrow="How it works" title="Core concepts" />
            <div className="grid gap-4 md:grid-cols-3">
              {[
                {
                  icon: Lock,
                  title: "Policy-governed encryption",
                  body: "The access policy is embedded inside the ciphertext and evaluated by the core before any decryption happens. If the identity does not satisfy the policy, the data is never decrypted — the rules cannot be bypassed by whoever holds the bytes.",
                },
                {
                  icon: ScrollText,
                  title: "Verifiable evidence",
                  body: "Every protect and access produces a receipt, signed with Dilithium and linked into a SHA-256 hash chain. Any tampering with a past entry breaks the chain, so the audit log is provably complete and untampered.",
                },
                {
                  icon: ShieldCheck,
                  title: "Post-quantum by default",
                  body: "Data is protected with hybrid Kyber (ML-KEM) key encapsulation and AES-256-GCM, and signed with Dilithium (ML-DSA). These are NIST-selected algorithms designed to resist attacks from future quantum computers.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <Card key={title} className="bg-white/70">
                  <CardHeader className="pb-2">
                    <span className="mb-1 grid h-9 w-9 place-items-center rounded-lg bg-blue/10 text-blue">
                      <Icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="text-base">{title}</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0 text-sm leading-relaxed text-muted">{body}</CardContent>
                </Card>
              ))}
            </div>
            <div className="mt-4">
              <Callout tone="blue" icon={Lock}>
                The key insight: the policy is checked <strong>before</strong> decryption, by the one trusted component
                (the Go core). Holding the ciphertext is not enough — you also have to satisfy the rules baked into it.
              </Callout>
            </div>
          </section>

          {/* 4. POLICIES */}
          <section id="policies" className="scroll-mt-24">
            <SectionHeading id="policies" eyebrow="Access rules" title="Writing policies" />
            <div className="flex flex-col gap-5">
              <p className="text-[.95rem] leading-relaxed text-ink-2">
                A policy describes who may access the data. There are two ways to write one — start with the
                shorthand, reach for the structured form when you need specific operators.
              </p>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="ink">Shorthand</Badge>
                    <span className="text-sm text-muted">concise, one key per condition</span>
                  </div>
                  <CodeBlock lang="python" code={POLICY_SHORTHAND} />
                  <p className="text-sm text-muted">
                    A list becomes an <Code>in</Code> check; <Code>expiry</Code> becomes a <Code>before</Code> with the
                    duration expanded to an absolute timestamp.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant="blue">Structured</Badge>
                    <span className="text-sm text-muted">explicit, every operator</span>
                  </div>
                  <CodeBlock lang="python" code={POLICY_STRUCTURED} />
                  <p className="text-sm text-muted">
                    Set <Code>combination</Code> to <Code>all</Code> (every condition must pass) or <Code>any</Code>{" "}
                    (at least one).
                  </p>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-display text-base font-bold">Condition types</h3>
                <DataTable
                  head={["Type", "Meaning", "Common operators"]}
                  rows={CONDITION_TYPES.map(([t, m, o]) => [
                    <code key="t" className="font-mono text-[.82rem] text-blue">{t}</code>,
                    <span key="m">{m}</span>,
                    <span key="o" className="font-mono text-[.8rem] text-muted">{o}</span>,
                  ])}
                />
              </div>

              <div>
                <h3 className="mb-2 font-display text-base font-bold">Operators</h3>
                <div className="flex flex-wrap gap-1.5">
                  {OPERATORS.flat().map((op) => (
                    <code key={op} className="rounded-md border border-line bg-tint px-2 py-1 font-mono text-[.78rem] text-ink-2">
                      {op}
                    </code>
                  ))}
                </div>
                <p className="mt-2 text-sm text-muted">
                  Equality (<Code>equals</Code>, <Code>not_equals</Code>), membership (<Code>in</Code>,{" "}
                  <Code>one_of</Code>), time ordering (<Code>before</Code>, <Code>after</Code>, <Code>between</Code>),
                  and numeric comparison (<Code>gt</Code>, <Code>gte</Code>, <Code>lt</Code>, <Code>lte</Code>).
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-display text-base font-bold">Example: time-boxed, purpose-limited access</h3>
                <CodeBlock lang="python" code={POLICY_EX_TIME} />
                <p className="mt-2 text-sm text-muted">
                  Grants access for treatment or emergencies, only during working hours, only within the EU
                  jurisdiction.
                </p>
              </div>

              <Callout tone="mint" icon={Play}>
                Not sure a policy does what you think? The{" "}
                <Link href="/playground">policy playground</Link> evaluates a policy against an identity against the
                real core engine — no data is encrypted and nothing is logged.
              </Callout>
            </div>
          </section>

          {/* 5. SDK */}
          <section id="sdk" className="scroll-mt-24">
            <SectionHeading id="sdk" eyebrow="Python" title="SDK reference" />
            <div className="flex flex-col gap-5">
              <div>
                <h3 className="mb-2 font-display text-base font-bold">Functions</h3>
                <DataTable
                  head={["Function", "Purpose"]}
                  rows={SDK_FUNCS.map(([fn, p]) => [
                    <code key="fn" className="font-mono text-[.8rem] text-blue">{fn}</code>,
                    <span key="p">{p}</span>,
                  ])}
                />
              </div>

              <div>
                <h3 className="mb-2 font-display text-base font-bold">Configure</h3>
                <CodeBlock lang="python" code={SDK_CONFIGURE} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-display text-base font-bold">Key lifecycle</h3>
                  <CodeBlock lang="python" code={SDK_KEYS} />
                </div>
                <div>
                  <h3 className="mb-2 font-display text-base font-bold">Audit evidence</h3>
                  <CodeBlock lang="python" code={SDK_EVIDENCE} />
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-display text-base font-bold">Exception hierarchy</h3>
                <DataTable
                  head={["Exception", "Raised when"]}
                  rows={EXCEPTIONS.map(([e, w]) => [
                    <code key="e" className="font-mono text-[.8rem] text-blue">{e}</code>,
                    <span key="w">{w}</span>,
                  ])}
                />
                <p className="mt-2 text-sm text-muted">
                  All exceptions inherit from <Code>PrivyQError</Code>, so a single <Code>except</Code> can catch the
                  whole family.
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-display text-base font-bold">Environment variables</h3>
                <DataTable
                  head={["Variable", "Default", "Purpose"]}
                  rows={ENV_VARS.map(([v, d, p]) => [
                    <code key="v" className="font-mono text-[.8rem] text-blue">{v}</code>,
                    <code key="d" className="font-mono text-[.8rem] text-ink-2">{d}</code>,
                    <span key="p">{p}</span>,
                  ])}
                />
              </div>
            </div>
          </section>

          {/* 6. REST */}
          <section id="rest" className="scroll-mt-24">
            <SectionHeading id="rest" eyebrow="HTTP" title="REST API" />
            <div className="flex flex-col gap-5">
              <p className="text-[.95rem] leading-relaxed text-ink-2">
                The FastAPI gateway exposes the same capabilities over REST. The base URL comes from{" "}
                <Code>NEXT_PUBLIC_API_URL</Code> and defaults to <Code>http://localhost:8000</Code>. Payload data
                (plaintext and ciphertext) is base64-encoded.
              </p>
              <DataTable
                head={["Method", "Endpoint", "Description"]}
                rows={ENDPOINTS.map(([m, p, d]) => [
                  <Badge key="m" variant={m === "GET" ? "muted" : "blue"} size="sm">{m}</Badge>,
                  <code key="p" className="font-mono text-[.8rem] text-ink-2">{p}</code>,
                  <span key="d">{d}</span>,
                ])}
              />
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-display text-base font-bold">Protect</h3>
                  <CodeBlock lang="bash" code={CURL_PROTECT} />
                </div>
                <div>
                  <h3 className="mb-2 font-display text-base font-bold">Access</h3>
                  <CodeBlock lang="bash" code={CURL_ACCESS} />
                </div>
              </div>
              <Callout tone="blue" icon={Boxes}>
                When the gateway is running, the full interactive OpenAPI reference is served at{" "}
                <a href="http://localhost:8000/docs" target="_blank" rel="noopener">localhost:8000/docs</a>.
              </Callout>
            </div>
          </section>

          {/* 7. RUNNING */}
          <section id="running" className="scroll-mt-24">
            <SectionHeading id="running" eyebrow="Local dev" title="Running it" />
            <div className="flex flex-col gap-5">
              <p className="text-[.95rem] leading-relaxed text-ink-2">
                The quickest way to run everything is Docker Compose, which brings up the core, gateway, frontend and
                PostgreSQL together.
              </p>
              <CodeBlock lang="bash" code={RUN_MAKE} />
              <div>
                <h3 className="mb-2 font-display text-base font-bold">Ports</h3>
                <DataTable
                  head={["Service", "Port", "Protocol"]}
                  rows={[
                    ["Go core (privyqd)", "50051", "gRPC"],
                    ["FastAPI gateway", "8000", "HTTP / REST"],
                    ["Next.js frontend", "3000", "HTTP"],
                    ["PostgreSQL", "5432", "TCP"],
                  ].map(([s, p, pr]) => [
                    <span key="s">{s}</span>,
                    <code key="p" className="font-mono text-[.82rem] text-blue">{p}</code>,
                    <span key="pr" className="text-muted">{pr}</span>,
                  ])}
                />
              </div>
              <div>
                <h3 className="mb-2 font-display text-base font-bold">Or run components individually</h3>
                <CodeBlock lang="bash" code={RUN_COMPONENTS} />
              </div>
            </div>
          </section>

          {/* 8. ARCHITECTURE */}
          <section id="architecture" className="scroll-mt-24">
            <SectionHeading id="architecture" eyebrow="System" title="Architecture" />
            <div className="flex flex-col gap-5">
              <p className="text-[.95rem] leading-relaxed text-ink-2">
                Requests flow down through thin layers until they reach the Go core, which is the only component that
                ever touches plaintext, keys, or policy decisions.
              </p>

              <div className="scroll-thin overflow-x-auto">
                <div className="flex min-w-max flex-col items-stretch gap-0 font-mono text-sm">
                  {[
                    { label: "Next.js frontend", note: "this demo UI", tone: "border-line bg-white/70 text-ink-2" },
                    { label: "FastAPI gateway", note: "REST facade", tone: "border-line bg-white/70 text-ink-2" },
                    { label: "Python SDK (privyq)", note: "protect · access · verify", tone: "border-line bg-white/70 text-ink-2" },
                    { label: "gRPC", note: "wire protocol", tone: "border-dashed border-line bg-tint/60 text-muted" },
                    { label: "Go core (privyqd)", note: "crypto · policy · audit · keys — the only trusted component", tone: "border-blue/40 bg-blue/[.07] text-ink" },
                    { label: "Cloudflare CIRCL", note: "pure-Go post-quantum primitives", tone: "border-line bg-white/70 text-ink-2" },
                  ].map((row, i, arr) => (
                    <React.Fragment key={row.label}>
                      <div className={cn("flex items-center justify-between gap-6 rounded-lg border px-4 py-3", row.tone)}>
                        <span className="font-semibold">{row.label}</span>
                        <span className="text-[.78rem] opacity-80">{row.note}</span>
                      </div>
                      {i < arr.length - 1 && <div className="mx-auto h-4 w-px bg-line" aria-hidden="true" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <Callout tone="blue" icon={KeyRound}>
                PostgreSQL persists the managed keys and the append-only evidence chain. Everything above the core is
                deliberately dumb: no keys, no plaintext, no policy logic lives outside the core, so there is exactly
                one component to trust and audit.
              </Callout>
            </div>
          </section>

          {/* 9. SECURITY */}
          <section id="security" className="scroll-mt-24">
            <SectionHeading id="security" eyebrow="Be honest" title="Security & limitations" />
            <div className="flex flex-col gap-4">
              <p className="text-[.95rem] leading-relaxed text-ink-2">
                PrivyQ is a working reference implementation. A few things to keep in mind before treating it as
                production-ready:
              </p>
              <div className="grid gap-3 md:grid-cols-2">
                {[
                  {
                    title: "Development key store",
                    body: "The dev configuration keeps keys in memory or a plain database. Production deployments should back the KMS with an HSM or cloud KMS for key material at rest.",
                  },
                  {
                    title: "PQC maturity",
                    body: "Post-quantum algorithms are relatively new. Kyber and Dilithium are NIST-selected, but the ecosystem is still maturing and implementations may hold undiscovered weaknesses.",
                  },
                  {
                    title: "Larger keys, slower ops",
                    body: "Post-quantum keys are bigger and operations are slower than classical equivalents. Budget for the size and latency difference in high-throughput paths.",
                  },
                  {
                    title: "Policies need re-encryption",
                    body: "Because the policy is embedded in the ciphertext, changing the rules on existing data means re-protecting it. Policy expressiveness is bounded by the defined condition types.",
                  },
                  {
                    title: "Infrastructure dependencies",
                    body: "The system needs its separate services running and reachable, plus reliable storage for the audit chain. Network connectivity between layers is required.",
                  },
                  {
                    title: "Limited formal validation",
                    body: "This is a reference implementation with limited formal verification and adversarial testing. Validate against your own threat model before relying on it.",
                  },
                ].map(({ title, body }) => (
                  <Card key={title} className="bg-white/70">
                    <CardContent className="flex flex-col gap-1.5 p-4">
                      <div className="flex items-center gap-2">
                        <TriangleAlert className="h-4 w-4 text-amber" />
                        <span className="font-display text-sm font-bold text-ink">{title}</span>
                      </div>
                      <p className="text-sm leading-relaxed text-muted">{body}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              <Callout tone="mint" icon={ShieldCheck}>
                Ready to see it in action? <Link href="/app">Launch the demo</Link> or read the source on{" "}
                <a href={GITHUB_URL} target="_blank" rel="noopener">GitHub</a>.
              </Callout>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
