"""
Example 1 — Healthcare: Secure Patient Records
==============================================

THE PROBLEM
-----------
A hospital stores a patient's chart. Regulations (HIPAA, GDPR-health) require
that only the *right* people read it — the treating cardiologist, yes; a nurse
from an unrelated ward, no — and that the hospital can *prove*, later and
irrefutably, exactly who accessed the record and whether that access was allowed.

Ordinary encryption can keep the chart confidential, but it can't answer "who may
open this, and under what circumstances?" nor "prove that the rules were honored."

HOW PrivyQ SOLVES IT
--------------------
We `protect()` the chart with a policy embedded *inside* the ciphertext:

    role = doctor  AND  department in {cardiology}  AND  purpose = treatment
    AND  the grant has not expired

Decryption (`access()`) is refused unless the requester satisfies that policy —
and every attempt, allowed or denied, produces a signed, hash-chained receipt we
can `verify()`.

WHAT THIS EXAMPLE DEMONSTRATES
------------------------------
  * Embedding a role/department/purpose/expiry policy in encrypted data
  * An authorized read (the cardiologist) succeeding
  * Two unauthorized reads (wrong role, wrong purpose) being denied — yet audited
  * Verifying a receipt and the whole tamper-evident evidence chain

Run me:  python examples/01_healthcare_records.py
(Start the core first — see examples/README.md.)
"""
from __future__ import annotations

import os
import sys

import privyq
from privyq import CoreUnreachableError, PolicyViolationError

# ── tiny console helpers (kept inline so this file is copy-paste standalone) ──
def banner(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m\n" + "─" * len(title))


def show(label: str, value: str) -> None:
    print(f"  {label:<22} {value}")


def main() -> None:
    # 1) Point the SDK at the core. Reads PRIVYQ_CORE_ADDRESS or defaults to
    #    localhost:50051. Everything below is plain, synchronous function calls.
    privyq.configure(core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"))

    banner("① PROTECT — the cardiologist locks a patient's chart")
    chart = (
        "Patient: John Doe (58). Dx: mild LV hypertrophy. BP 132/84. "
        "Plan: continue beta-blocker, echo in 3 months."
    )

    # The policy is expressed as a plain dict. A list value (department) means
    # "must be one of"; "expiry" accepts a human duration and is expanded to an
    # absolute deadline. These rules now travel *inside* the ciphertext.
    protected = privyq.protect(
        chart,
        policy={
            "role": "doctor",
            "department": ["cardiology"],
            "purpose": "treatment",
            "expiry": "24h",
        },
        resource_id="patient_john_doe",
        actor={"user_id": "dr_amara", "role": "doctor", "department": "cardiology"},
    )
    show("encrypted under key", protected.key_id)
    show("policy fingerprint", protected.policy_hash[:16] + "…")
    show("bytes on the wire", f"{len(protected.raw)} bytes of ciphertext + embedded policy")

    banner("② ACCESS (authorized) — Dr. Amara, cardiology, for treatment")
    result = privyq.access(
        protected,
        identity={
            "user_id": "dr_amara",
            "role": "doctor",
            "department": "cardiology",
            "purpose": "treatment",
        },
    )
    show("decision", "GRANTED ✓")
    show("decrypted chart", result.text)
    show("signed receipt", result.receipt.id)

    banner("③ ACCESS (denied) — a nurse from the general ward")
    try:
        privyq.access(
            protected,
            identity={"user_id": "nurse_bello", "role": "nurse", "department": "general"},
        )
    except PolicyViolationError as why:
        # No plaintext is returned. The attempt is NOT silently dropped — it is
        # recorded as a signed "denied" receipt (we'll see it in the log below).
        show("decision", "DENIED ✕")
        show("reason", str(why))

    banner("④ ACCESS (denied) — a doctor, but for the wrong purpose (research)")
    try:
        privyq.access(
            protected,
            identity={
                "user_id": "dr_chen",
                "role": "doctor",
                "department": "cardiology",
                "purpose": "research",  # policy requires purpose == treatment
            },
        )
    except PolicyViolationError as why:
        show("decision", "DENIED ✕")
        show("reason", str(why))

    banner("⑤ VERIFY — the audit trail is complete and tamper-evident")
    # Pull every receipt for this record. Note it contains BOTH the granted read
    # and the two denied attempts — you can prove misuse, not just usage.
    receipts = privyq.evidence.log(resource_id="patient_john_doe")
    print(f"  {len(receipts)} receipt(s) recorded for this patient:")
    for r in receipts:
        mark = "✓" if r.result == "granted" else "✕"
        check = privyq.verify(r)  # signature + hash-chain verification, in the core
        print(
            f"    {mark} {r.result:<8} by {r.actor:<12} "
            f"(op={r.operation}, verified={check.ok}, chain_ok={check.chain_valid})"
        )
    print(
        "\n  Every entry is Dilithium-signed and linked to the previous one by a\n"
        "  SHA-256 hash. Editing, deleting, or reordering any entry breaks the\n"
        "  chain — so this log is admissible evidence of compliance."
    )


if __name__ == "__main__":
    try:
        main()
    except CoreUnreachableError:
        sys.exit(
            "\n✗ Could not reach the PrivyQ core.\n"
            "  Start it first:  cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd\n"
            "  (see examples/README.md)"
        )
