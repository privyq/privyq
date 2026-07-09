"""
Example 2 — Finance: Cross-Border Data & Time-Boxed Compliance Access
=====================================================================

THE PROBLEM
-----------
A bank must share a customer's account statement with a compliance auditor — but
only:
  * from within the **EU** jurisdiction (GDPR data-residency),
  * for the stated **purpose** of an audit (not marketing, not advisory),
  * and only during the **approved audit window** (say, Q3 2026) — not before it
    opens, not after it closes.

These are contextual, *time-bounded*, *jurisdictional* rules that classic
role-based access control handles poorly.

HOW PrivyQ SOLVES IT
--------------------
The policy embeds jurisdiction, purpose, a data-handling classification, and a
`valid_from`/`valid_until` window. Because `access()` can be evaluated against an
explicit request **context** (including a timestamp), we can demonstrate the same
protected statement being denied *before* the window opens and granted *inside*
it — deterministically.

WHAT THIS EXAMPLE DEMONSTRATES
------------------------------
  * Jurisdictional + purpose + classification conditions
  * Time-window policies (`valid_from` / `valid_until`) evaluated against a
    supplied request timestamp
  * Producing a compliance-ready evidence report for the record

Run me:  python examples/02_financial_compliance.py
"""
from __future__ import annotations

import os
import sys

import privyq
from privyq import CoreUnreachableError, PolicyViolationError


def banner(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m\n" + "─" * len(title))


def show(label: str, value: str) -> None:
    print(f"  {label:<24} {value}")


def try_access(protected, *, who: str, identity: dict, at: str | None = None) -> None:
    """Attempt an access and narrate the outcome. `at` is a simulated request
    time (RFC3339) so time-window rules are deterministic in this demo."""
    context = {"timestamp": at} if at else None
    try:
        result = privyq.access(protected, identity=identity, context=context)
        show(who, f"GRANTED ✓  →  {result.text[:48]}…")
    except PolicyViolationError as why:
        show(who, f"DENIED ✕  ({why})")


def main() -> None:
    privyq.configure(core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"))

    banner("① PROTECT — a customer statement, released only for an EU audit window")
    statement = "Acct ****4417 — Q3 2026: 42 transactions, closing balance €18,204.55"

    protected = privyq.protect(
        statement,
        policy={
            "jurisdiction": ["EU", "GDPR"],          # data-residency: EU only
            "purpose": "audit",                       # audit — not advisory/marketing
            "classification": ["confidential"],       # handler must be cleared for confidential
            "valid_from": "2026-07-01T00:00:00Z",     # window opens
            "valid_until": "2026-09-30T23:59:59Z",    # window closes
        },
        resource_id="statement_4417_q3",
        actor={"user_id": "bank_system", "role": "system", "organization": "EuroBank"},
    )
    show("protected statement", protected.resource_id if hasattr(protected, "resource_id") else "statement_4417_q3")
    show("policy fingerprint", protected.policy_hash[:16] + "…")

    banner("② ACCESS attempts — same data, different context")

    eu_auditor = {
        "user_id": "auditor_eu",
        "role": "compliance_officer",
        "jurisdiction": "EU",
        "purpose": "audit",
        "classification": "confidential",
    }

    # (a) Correct auditor, but BEFORE the window opens → time-window denies it.
    try_access(protected, who="EU auditor, but in June (early)", identity=eu_auditor,
               at="2026-06-15T10:00:00Z")

    # (b) Correct auditor, INSIDE the window → granted.
    try_access(protected, who="EU auditor, in August (in window)", identity=eu_auditor,
               at="2026-08-15T10:00:00Z")

    # (c) Right time & purpose, but a US-jurisdiction auditor → jurisdiction denies.
    try_access(
        protected,
        who="US auditor, in window",
        identity={**eu_auditor, "user_id": "auditor_us", "jurisdiction": "US"},
        at="2026-08-15T10:00:00Z",
    )

    # (d) EU auditor, in window, but for advisory purpose → purpose denies.
    try_access(
        protected,
        who="EU advisor (wrong purpose)",
        identity={**eu_auditor, "user_id": "advisor_eu", "purpose": "advisory"},
        at="2026-08-15T10:00:00Z",
    )

    banner("③ COMPLIANCE REPORT — a verifiable record of every access decision")
    receipts = privyq.evidence.log(resource_id="statement_4417_q3")
    print(f"  {len(receipts)} access decision(s) on this statement:\n")
    print(f"    {'WHEN':<22}{'ACTOR':<14}{'RESULT':<10}{'VERIFIED'}")
    for r in receipts:
        check = privyq.verify(r)
        print(f"    {r.timestamp:<22}{r.actor:<14}{r.result:<10}{check.ok}")
    print(
        "\n  This report is self-authenticating: each row is signed and hash-chained,\n"
        "  so a regulator can confirm it wasn't edited after the fact."
    )


if __name__ == "__main__":
    try:
        main()
    except CoreUnreachableError:
        sys.exit(
            "\n✗ Could not reach the PrivyQ core.\n"
            "  Start it first:  cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd\n"
        )
