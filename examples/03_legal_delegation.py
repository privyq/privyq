"""
Example 3 — Legal: A Privileged Brief (file) with Delegation & Key Lifecycle
============================================================================

THE PROBLEM
-----------
A law firm holds a privileged motion as a document file. Partner Alice wants a
specific associate to work on it under her delegation — but not un-delegated
associates, and not outside counsel. Separately, when a contractor off-boards,
the firm must instantly and provably revoke their ability to open anything sealed
for them.

WHAT THIS EXAMPLE DEMONSTRATES
------------------------------
  * Protecting a real document file (`data/motion_to_dismiss.md`) into a sealed
    `.privyq` file.
  * A delegation-gated policy (`delegation`, `delegated_from`) + multi-value role.
  * Granting the delegated associate (who decrypts the brief back to disk),
    denying an un-delegated associate and outside counsel.
  * Key lifecycle: `generate_key` → `rotate_key` → `revoke_key`, and how
    revocation makes a sealed file permanently unreadable.

Run me:  python examples/03_legal_delegation.py
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import privyq
from privyq import CoreUnreachableError, PolicyViolationError, PrivyQError

HERE = Path(__file__).resolve().parent
BRIEF = HERE / "data" / "motion_to_dismiss.md"


def banner(t: str) -> None:
    print(f"\n\033[1m{t}\033[0m\n" + "─" * len(t))


def show(label: str, value: str) -> None:
    print(f"  {label:<30} {value}")


def main() -> None:
    privyq.configure(core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"))
    vault = Path(tempfile.mkdtemp(prefix="privyq_legal_"))

    # ── PART A — delegation ────────────────────────────────────────────────
    banner("PART A ①  PROTECT — seal the privileged brief")
    plaintext = BRIEF.read_bytes()
    show("source file", f"{BRIEF}  ({len(plaintext)} bytes)")
    show("first line", plaintext.decode().splitlines()[0])

    protected = privyq.protect(
        plaintext,
        policy={
            "role": ["partner", "associate"],      # firm counsel only
            "classification": "privileged",
            "delegation": "granted",
            "delegated_from": "partner_alice",
        },
        resource_id="motion_dismiss_v3",
        actor={"user_id": "partner_alice", "role": "partner", "organization": "Alice & Co"},
    )
    sealed_path = vault / "motion_to_dismiss.md.privyq"
    sealed_path.write_bytes(protected.raw)
    show("sealed file", str(sealed_path))
    sealed = sealed_path.read_bytes()

    banner("PART A ②  ACCESS — only the delegated associate gets in")
    # Delegated associate — decrypts the brief back to a file.
    try:
        result = privyq.access(sealed, identity={
            "user_id": "assoc_ben", "role": "associate", "classification": "privileged",
            "delegation": "granted", "delegated_from": "partner_alice",
        })
        out = vault / "motion_to_dismiss.recovered.md"
        out.write_bytes(result.data)
        show("delegated associate (Ben)", f"GRANTED ✓  → {out.name} (identical: {result.data == plaintext})")
    except PolicyViolationError as why:
        show("delegated associate (Ben)", f"DENIED ✕  ({why})")

    for who, identity in [
        ("un-delegated associate (Dana)",
         {"user_id": "assoc_dana", "role": "associate", "classification": "privileged"}),
        ("outside counsel",
         {"user_id": "ext", "role": "external_counsel", "classification": "privileged",
          "delegation": "granted", "delegated_from": "partner_alice"}),
    ]:
        try:
            privyq.access(sealed, identity=identity)
            show(who, "GRANTED ✗ (unexpected)")
        except PolicyViolationError as why:
            show(who, f"DENIED ✕  ({str(why).split('(')[0].strip()})")

    # ── PART B — key lifecycle ─────────────────────────────────────────────
    banner("PART B  KEY LIFECYCLE — rotation and off-boarding revocation")
    contractor_key = privyq.generate_key(
        key_type="encryption", organization="Alice & Co", owner="contractor_kim")
    show("issued contractor key", f"{contractor_key.key_id[:8]}…  ({contractor_key.status})")

    work = privyq.protect(
        b"Contractor work product: privileged discovery index and notes.",
        policy={"role": "contractor"},
        key_id=contractor_key.key_id,
        resource_id="discovery_index",
        actor={"user_id": "contractor_kim", "role": "contractor"},
    )
    work_sealed = work.raw
    opened = privyq.access(work_sealed, identity={"user_id": "contractor_kim", "role": "contractor"})
    show("access while engaged", f"GRANTED ✓  ({len(opened.data)} bytes)")

    rot = privyq.rotate_key(contractor_key.key_id)
    show("key rotated", f"{rot.old_key_id[:8]}…  →  {rot.new_key_id[:8]}…")

    rev = privyq.revoke_key(contractor_key.key_id)
    show("key revoked at", rev.revoked_at)
    try:
        privyq.access(work_sealed, identity={"user_id": "contractor_kim", "role": "contractor"})
        show("access after off-boarding", "GRANTED ✗ (unexpected)")
    except PrivyQError as why:
        show("access after off-boarding", f"BLOCKED ✓  ({str(why).split(':')[-1].strip()})")

    print(f"\n  Sealed + recovered files in:  {vault}")


if __name__ == "__main__":
    try:
        main()
    except CoreUnreachableError:
        sys.exit(
            "\n✗ Could not reach the PrivyQ core.\n"
            "  Start it first:  cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd\n"
        )
