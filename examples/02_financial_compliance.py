"""
Example 2 — Finance: Sealing a Bank Statement (CSV file) for a Compliance Window
================================================================================

THE PROBLEM
-----------
A bank must release a customer's account statement — a real CSV file — to a
compliance auditor, but only from within the EU, only for an audit, and only
during the approved audit window (Q3 2026). Outside those conditions the file
must stay sealed.

WHAT THIS EXAMPLE DEMONSTRATES
------------------------------
  * Protecting a CSV file (`data/account_statement.csv`) into a sealed
    `.privyq` file.
  * Jurisdiction + purpose + classification + time-window policy.
  * The same sealed file denied before the window opens, decrypted inside it,
    and denied for the wrong jurisdiction/purpose — driven by a supplied request
    timestamp so the demo is deterministic.
  * A self-authenticating compliance report of every decision.

Run me:  python examples/02_financial_compliance.py
"""
from __future__ import annotations

import csv
import io
import os
import sys
import tempfile
from pathlib import Path

import privyq
from privyq import CoreUnreachableError, PolicyViolationError

HERE = Path(__file__).resolve().parent
STATEMENT = HERE / "data" / "account_statement.csv"
RESOURCE = "statement_4417_q3"


def banner(t: str) -> None:
    print(f"\n\033[1m{t}\033[0m\n" + "─" * len(t))


def show(label: str, value: str) -> None:
    print(f"  {label:<30} {value}")


def try_access(sealed: bytes, *, who: str, identity: dict, at: str | None) -> bytes | None:
    context = {"timestamp": at} if at else None
    try:
        result = privyq.access(sealed, identity=identity, context=context)
        show(who, "GRANTED ✓")
        return result.data
    except PolicyViolationError as why:
        show(who, f"DENIED ✕  ({str(why).split('(')[0].strip()})")
        return None


def main() -> None:
    privyq.configure(core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"))
    vault = Path(tempfile.mkdtemp(prefix="privyq_finance_"))

    banner("① READ — the raw statement CSV")
    plaintext = STATEMENT.read_bytes()
    rows = list(csv.reader(io.StringIO(plaintext.decode())))
    show("source file", str(STATEMENT))
    show("transactions", f"{len(rows) - 1} rows")
    print("  preview:")
    for row in rows[:4]:
        print("      " + ",".join(row))
    print("      …")

    banner("② PROTECT — seal the CSV for an EU audit window (Q3 2026)")
    protected = privyq.protect(
        plaintext,
        policy={
            "jurisdiction": ["EU", "GDPR"],
            "purpose": "audit",
            "classification": ["confidential"],
            "valid_from": "2026-07-01T00:00:00Z",
            "valid_until": "2026-09-30T23:59:59Z",
        },
        resource_id=RESOURCE,
        actor={"user_id": "bank_system", "role": "system", "organization": "EuroBank"},
    )
    sealed_path = vault / "account_statement.csv.privyq"
    sealed_path.write_bytes(protected.raw)
    show("sealed file", str(sealed_path))
    # Sentinel must be content-only (the resource_id label is plaintext metadata
    # by design). "Meridian GmbH" appears only inside the CSV transactions.
    show("statement data leaked?", "NO ✓" if b"Meridian" not in sealed_path.read_bytes() else "YES ✗")

    banner("③ ACCESS — same sealed file, different context")
    sealed = sealed_path.read_bytes()
    eu_auditor = {
        "user_id": "auditor_eu", "role": "compliance_officer",
        "jurisdiction": "EU", "purpose": "audit", "classification": "confidential",
    }
    try_access(sealed, who="EU auditor — June (before window)", identity=eu_auditor, at="2026-06-15T10:00:00Z")
    plaintext_out = try_access(sealed, who="EU auditor — August (in window)", identity=eu_auditor, at="2026-08-15T10:00:00Z")
    try_access(sealed, who="US auditor — in window", identity={**eu_auditor, "user_id": "auditor_us", "jurisdiction": "US"}, at="2026-08-15T10:00:00Z")
    try_access(sealed, who="EU advisor — wrong purpose", identity={**eu_auditor, "user_id": "advisor_eu", "purpose": "advisory"}, at="2026-08-15T10:00:00Z")

    if plaintext_out is not None:
        recovered = vault / "account_statement.recovered.csv"
        recovered.write_bytes(plaintext_out)
        show("recovered CSV", f"{recovered}  (identical: {plaintext_out == plaintext})")

    banner("④ COMPLIANCE REPORT — verifiable record of every decision")
    receipts = privyq.evidence.log(resource_id=RESOURCE)
    print(f"    {'WHEN':<22}{'ACTOR':<14}{'RESULT':<10}{'VERIFIED'}")
    for r in receipts:
        print(f"    {r.timestamp:<22}{r.actor:<14}{r.result:<10}{privyq.verify(r).ok}")
    print(f"\n  Sealed + recovered files in:  {vault}")


if __name__ == "__main__":
    try:
        main()
    except CoreUnreachableError:
        sys.exit(
            "\n✗ Could not reach the PrivyQ core.\n"
            "  Start it first:  cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd\n"
        )
