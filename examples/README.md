# PrivyQ Examples

Four self-contained, heavily-commented programs that each apply PrivyQ to a
different real-world domain. They're written to be **read as tutorials** — every
step explains *what* it does and *why* — and to be **run as demos**.

| # | File | Domain | What it teaches |
|---|------|--------|-----------------|
| 1 | [`01_healthcare_records.py`](01_healthcare_records.py) | Healthcare | Role/department/purpose policies, granted vs denied access, verifiable audit receipts |
| 2 | [`02_financial_compliance.py`](02_financial_compliance.py) | Finance / GDPR | Jurisdiction + time-window policies, a compliance evidence report |
| 3 | [`03_legal_delegation.py`](03_legal_delegation.py) | Legal | Delegated access, multi-role conditions, key rotation & revocation |
| 4 | [`04_ai_data_governance.py`](04_ai_data_governance.py) | AI / ML | Purpose-bound data (anti-repurposing) and the evidence chain as data lineage |

## Prerequisites

Each example uses the **Python SDK**, which talks to a running **core** (`privyqd`).

**1 — start the core** (in one terminal; in-memory storage is perfect for demos):

```bash
cd core-go
KEY_STORAGE=memory go run ./cmd/privyqd
# → privyqd 1.0.0 listening on :50051
```

**2 — install the SDK** (in another terminal):

```bash
pip install -e ./sdk-python
```

**3 — run any example:**

```bash
python examples/01_healthcare_records.py
```

Point the SDK at a non-default core with `PRIVYQ_CORE_ADDRESS=host:port` if needed.
If the core isn't running, each example prints a clear instruction instead of a
stack trace.

## The mental model these examples reinforce

Every example follows the same three verbs:

- **`protect(data, policy)`** — encrypt data with the access rules *embedded in
  the ciphertext*.
- **`access(protected, identity)`** — decrypt **only if** the identity satisfies
  the policy; otherwise it raises `PolicyViolationError` — and the denied attempt
  is still recorded.
- **`verify(receipt)`** — cryptographically confirm an audit receipt (signature +
  hash chain), so the log is tamper-evident.

The differences between the examples are entirely in the **policies** and the
**identities** — which is the point: the same primitives express healthcare RBAC,
cross-border compliance, legal delegation, and AI data governance.
