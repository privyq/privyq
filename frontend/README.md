# PrivyQ Frontend

**The demo you can click.** An interactive Next.js application that shows the
whole PrivyQ story end to end — protect a record with an embedded policy, request
access as different people, watch the policy decide, and verify the signed,
hash-chained evidence for every attempt.

It is the top layer of the PrivyQ stack and the visual home of the
medical-records scenario (BP §25). The design is migrated from the
the original design prototype prototype: the "light aurora" system, the blue → violet → pink
accents, and the three typefaces (Bricolage Grotesque / Hanken Grotesk /
JetBrains Mono).

> Status: Phase 5. Builds and runs today against seeded demo data; wires to the
> FastAPI gateway when one is reachable.

## Its place in the architecture

```
▶ Next.js frontend ──HTTPS/REST──▶ FastAPI gateway ──▶ Python SDK ──gRPC──▶ Go core ──CGO──▶ liboqs
  (this package)                    (auth, rate limit)  (protect/access/verify)  (all crypto, policy, audit)
```

The frontend calls the gateway's REST API (see `docs/blueprint.md` Appendix B) via
a single typed client, `services/api.ts`. It performs **no cryptography and no
policy decisions of its own** — those belong to the Go core. When the gateway is
unreachable it degrades gracefully to seeded demo data and a small local *policy
mirror* (`lib/policy.ts`) so the UI still demonstrates the flows. Full system
design: [`docs/SYSTEM_ARCHITECTURE.md`](../docs/SYSTEM_ARCHITECTURE.md) §11.

## Stack

- **Next.js 14** (App Router) + **React 18**
- **TypeScript** (strict, `noUncheckedIndexedAccess`)
- **Tailwind CSS** with design tokens ported from the original design prototype (`tailwind.config.ts`, `app/globals.css`)
- **shadcn/ui-style primitives**, hand-written in `components/ui/` (button, card, input, select, badge, tabs)
- **Recharts** for audit visualisation
- **lucide-react** icons
- **Zod** available for validation

## Prerequisites

- Node.js 22+ and npm 10+
- (Optional) a running PrivyQ gateway at `NEXT_PUBLIC_API_URL` for live data.
  Without it, the app runs entirely on seeded demo data.

## Quickstart

```bash
cd frontend
npm install
cp .env.example .env.local     # optional; defaults to http://localhost:8000
npm run dev                    # http://localhost:3000
```

Production build / run:

```bash
npm run build
npm run start                  # serves the optimized build on :3000
```

Docker:

```bash
docker build -t privyq-frontend .
docker run -p 3000:3000 -e NEXT_PUBLIC_API_URL=http://gateway:8000 privyq-frontend
```

Scripts: `dev`, `build`, `start`, `lint`, `typecheck`.

## Worked example — the medical-records scenario (BP §25)

1. **Upload** (`/upload`) — as Dr. Amara Okafor, paste John Doe's notes, build a
   policy (`role = doctor`, `department = cardiology`, `purpose = treatment`,
   `classification = confidential`, `expiry before …`) and protect it. You get
   back protected data + policy hash + signed protect-evidence.
2. **Authorized access** (`/record/patient_001`) — with the **Doctor** persona
   selected in the header, request access. Every condition turns green, the vault
   unlocks, the plaintext types out, and a `GRANTED` receipt is chained.
3. **Unauthorized access** — switch the header to **Nurse Bello Musa** and try
   again. Role/department/purpose fail red, the vault shakes and stays locked,
   and a `DENIED` receipt is recorded (honestly, with its own hash).
4. **Audit verification** (`/audit`) — as **Administrator**, pick an evidence
   entry and verify it (signature / chain / policy all green). Use the tamper
   buttons (edit signature, edit timestamp, forge actor) to watch verification
   fail — proving the evidence detects modification.
5. **Keys** (`/keys`) and **Playground** (`/playground`) round out the demo:
   generate/rotate/revoke keys, and test any policy against any identity.

## Pages & components

| Route            | What it does                                             |
|------------------|----------------------------------------------------------|
| `/`              | Dashboard: persona welcome, stats, recent events, chart  |
| `/upload`        | Upload a record + **PolicyEditor**, calls `protect`      |
| `/records`       | Searchable list of protected records                     |
| `/record/[id]`   | Record detail + **AccessRequestCard** + receipts         |
| `/audit`         | Evidence log + **EvidenceVerifier** (tamper simulation)  |
| `/keys`          | Generate / rotate / revoke, **KeyStatusIndicator**       |
| `/playground`    | Test a policy against an identity                         |

Key components (ARCH §11.3): `components/policy-editor.tsx`,
`components/evidence-verifier.tsx`, `components/access-request-card.tsx`,
`components/key-status-indicator.tsx`. The header **role switcher**
(`components/role-switcher.tsx`, backed by `components/providers/identity-provider.tsx`)
selects the acting persona (Doctor / Nurse / Researcher / Admin), which drives the
`identity` sent to `POST /api/v1/access`.

## Configuration

| Variable              | Default                 | Description                                                        |
|-----------------------|-------------------------|--------------------------------------------------------------------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:8000` | Base URL of the FastAPI gateway. Read in the browser, so it must be reachable from the client. |
| `PORT`                | `3000`                  | Port for `next start` / the Docker image.                          |
| `NEXT_TELEMETRY_DISABLED` | (unset)             | Set to `1` to disable Next.js telemetry (done in the Dockerfile).  |

## Security notes & known limitations

- **No crypto or policy logic lives here.** `lib/policy.ts` is a *local mirror*
  used only for the offline demo fallback and the playground; it is deliberately
  simple and is **not** authoritative. Real evaluation and decryption happen only
  in the Go core.
- **Demo auth.** Personas are illustrative; there is no real authentication yet.
  The client sends a `Bearer` token when one is provided but does not manage
  sessions. NextAuth.js integration is future work (BP §13.3).
- **Seeded data.** `lib/demo-data.ts` populates records, keys, and a short
  evidence chain so the UI is usable without a backend. Signatures/hashes shown
  in demo mode are placeholders, not real Dilithium signatures.
- **Hand-written API types.** `lib/types.ts` is transcribed from Appendix B.
  The intended end state is to generate these from the gateway
  OpenAPI spec — see the `TODO(F2)` notes in `lib/types.ts` and `services/api.ts`.

## Known setup issues

None. `npm install` and `npm run build` complete on Node 22 / npm 10 against the
public npm registry. Fonts are loaded via `<link>` (as in the prototype) rather
than `next/font/google`, so the build never needs to fetch fonts from the network
and stays deterministic offline.

## Links

- [Full architecture](../docs/SYSTEM_ARCHITECTURE.md) · [Blueprint](../docs/blueprint.md) · [Repo README](../README.md)
- [Contributing](../CONTRIBUTING.md) · [License (MIT)](../LICENSE)
