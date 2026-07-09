"""
Example 3 — Legal: Privileged Documents, Delegation & Key Lifecycle
===================================================================

THE PROBLEM
-----------
A law firm holds an attorney-client **privileged** brief. Partner Alice wants an
associate to work on it — but *only* an associate she has explicitly delegated
to, and only while the firm's people (not outside counsel) are the readers. Later,
when a contractor leaves, the firm must be able to **revoke** their ability to
open anything sealed for them, immediately and provably.

HOW PrivyQ SOLVES IT
--------------------
Two capabilities combine here:

  * **Delegation as policy.** The brief's policy requires a delegation credential
    naming the delegator ("delegation = granted, delegated_from = partner_alice"),
    plus a firm role. An associate holding that credential gets in; the same
    associate without it does not.

  * **Key lifecycle.** Encryption keys can be rotated and revoked. Revoking the
    key a document was sealed under makes that document permanently unreadable —
    the enforcement point for off-boarding.

WHAT THIS EXAMPLE DEMONSTRATES
------------------------------
  * A delegation-gated policy (`delegation`, `delegated_from`) with a multi-value
    role condition (`role in {partner, associate}`)
  * Granting to a delegated associate, denying an un-delegated one and an outsider
  * `generate_key` → `rotate_key` → `revoke_key`, and how revocation cuts off access

Run me:  python examples/03_legal_delegation.py
"""
from __future__ import annotations

import os
import sys

import privyq
from privyq import CoreUnreachableError, PolicyViolationError, PrivyQError


def banner(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m\n" + "─" * len(title))


def show(label: str, value: str) -> None:
    print(f"  {label:<28} {value}")


def main() -> None:
    privyq.configure(core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"))

    # ─────────────────────────────────────────────────────────────────────────
    banner("PART A — Delegated access to a privileged brief")
    # ─────────────────────────────────────────────────────────────────────────
    brief = "PRIVILEGED & CONFIDENTIAL — Motion to dismiss, draft v3. Strategy: …"

    # The document may be opened only by a partner or associate who presents a
    # delegation credential granted by partner_alice, and who is cleared for
    # privileged material.
    protected = privyq.protect(
        brief,
        policy={
            "role": ["partner", "associate"],   # firm counsel only (multi-value → "in")
            "classification": "privileged",
            "delegation": "granted",
            "delegated_from": "partner_alice",
        },
        resource_id="motion_dismiss_v3",
        actor={"user_id": "partner_alice", "role": "partner", "organization": "Alice & Co"},
    )
    show("sealed brief", "motion_dismiss_v3")

    # (1) The delegated associate — carries the delegation credential.
    try:
        result = privyq.access(
            protected,
            identity={
                "user_id": "assoc_ben",
                "role": "associate",
                "classification": "privileged",
                "delegation": "granted",
                "delegated_from": "partner_alice",
            },
        )
        show("delegated associate (Ben)", f"GRANTED ✓  →  {result.text[:40]}…")
    except PolicyViolationError as why:
        show("delegated associate (Ben)", f"DENIED ✕  ({why})")

    # (2) An associate WITHOUT a delegation credential.
    try:
        privyq.access(
            protected,
            identity={"user_id": "assoc_dana", "role": "associate", "classification": "privileged"},
        )
        show("un-delegated associate (Dana)", "GRANTED ✓")
    except PolicyViolationError as why:
        show("un-delegated associate (Dana)", f"DENIED ✕  ({why})")

    # (3) Outside counsel — has a delegation token, but the wrong role.
    try:
        privyq.access(
            protected,
            identity={
                "user_id": "outside_counsel",
                "role": "external_counsel",
                "classification": "privileged",
                "delegation": "granted",
                "delegated_from": "partner_alice",
            },
        )
        show("outside counsel", "GRANTED ✓")
    except PolicyViolationError as why:
        show("outside counsel", f"DENIED ✕  ({why})")

    # ─────────────────────────────────────────────────────────────────────────
    banner("PART B — Key lifecycle: rotation and revocation (off-boarding)")
    # ─────────────────────────────────────────────────────────────────────────

    # Give a contractor their own encryption key, and seal a working file to it.
    contractor_key = privyq.generate_key(
        key_type="encryption", organization="Alice & Co", owner="contractor_kim"
    )
    show("issued key for contractor", f"{contractor_key.key_id}  ({contractor_key.status})")

    work_file = privyq.protect(
        "Contractor work product — discovery index.",
        policy={"role": "contractor"},
        key_id=contractor_key.key_id,          # seal under the contractor's key
        resource_id="discovery_index",
        actor={"user_id": "contractor_kim", "role": "contractor"},
    )

    # While employed, the contractor can open it.
    opened = privyq.access(work_file, identity={"user_id": "contractor_kim", "role": "contractor"})
    show("access while engaged", f"GRANTED ✓  →  {opened.text[:32]}…")

    # Rotation issues a fresh key while keeping the old one for historical data.
    rotated = privyq.rotate_key(contractor_key.key_id)
    show("rotated key", f"{rotated.old_key_id[:8]}…  →  {rotated.new_key_id[:8]}…")

    # The contractor leaves → revoke their key. Anything sealed under it is now
    # unreadable, immediately and provably.
    revoked = privyq.revoke_key(contractor_key.key_id)
    show("revoked key at", revoked.revoked_at)
    try:
        privyq.access(work_file, identity={"user_id": "contractor_kim", "role": "contractor"})
        show("access after off-boarding", "GRANTED ✗ (unexpected!)")
    except PrivyQError as why:
        show("access after off-boarding", f"BLOCKED ✓  ({why})")

    print(
        "\n  Delegation expresses *who may act on whose authority*; key revocation is\n"
        "  the hard cut-off when that authority ends. Both are enforced by the core."
    )


if __name__ == "__main__":
    try:
        main()
    except CoreUnreachableError:
        sys.exit(
            "\n✗ Could not reach the PrivyQ core.\n"
            "  Start it first:  cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd\n"
        )
