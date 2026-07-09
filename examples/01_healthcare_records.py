"""
Example 1 — Healthcare: Protecting a Real Patient Chart (a file)
================================================================

THE PROBLEM
-----------
A hospital's EHR exports a patient's cardiology chart as a file. That file must
be readable only by the right clinician, for the right reason, and every access
must be provable after the fact (HIPAA / GDPR-health).

WHAT THIS EXAMPLE DEMONSTRATES
------------------------------
  * Protecting an actual file on disk: read `data/patient_chart.txt`, seal it to
    an opaque `patient_chart.txt.privyq`, and confirm the ciphertext contains
    none of the plaintext.
  * A role/department/purpose/expiry policy embedded in the sealed file.
  * An authorized clinician decrypting the file back to disk, byte-for-byte;
    unauthorized attempts denied but audited.
  * Verifying the tamper-evident receipt chain.

Run me:  python examples/01_healthcare_records.py
(Start the core first — see examples/README.md.)
"""
from __future__ import annotations

import os
import sys
import tempfile
from pathlib import Path

import privyq
from privyq import CoreUnreachableError, PolicyViolationError

HERE = Path(__file__).resolve().parent
CHART = HERE / "data" / "patient_chart.txt"


def banner(t: str) -> None:
    print(f"\n\033[1m{t}\033[0m\n" + "─" * len(t))


def show(label: str, value: str) -> None:
    print(f"  {label:<24} {value}")


def main() -> None:
    privyq.configure(core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"))
    vault = Path(tempfile.mkdtemp(prefix="privyq_healthcare_"))

    banner("① READ — the plaintext chart exported from the EHR")
    plaintext = CHART.read_bytes()
    preview = plaintext.decode().splitlines()
    show("source file", str(CHART))
    show("size", f"{len(plaintext)} bytes")
    print("  preview:")
    for line in preview[:6]:
        print(f"      {line}")
    print("      …")

    banner("② PROTECT — seal the file with an access policy")
    protected = privyq.protect(
        plaintext,
        policy={
            "role": "doctor",
            "department": ["cardiology"],
            "purpose": "treatment",
            "expiry": "24h",
        },
        resource_id="chart_SGH-0042118",
        actor={"user_id": "dr_amara", "role": "doctor", "department": "cardiology"},
    )
    sealed_path = vault / "patient_chart.txt.privyq"
    sealed_path.write_bytes(protected.raw)          # <-- the encrypted file at rest
    show("sealed file", str(sealed_path))
    show("sealed size", f"{sealed_path.stat().st_size} bytes (ciphertext + embedded policy)")
    # Prove the sealed file leaks nothing: the patient's name is not in it.
    leaked = b"John A. Doe" in sealed_path.read_bytes()
    show("plaintext leaked?", "NO ✓ — ciphertext is opaque" if not leaked else "YES ✗")

    banner("③ ACCESS (authorized) — Dr. Amara decrypts the file back to disk")
    sealed = sealed_path.read_bytes()               # load the .privyq from disk
    result = privyq.access(
        sealed,
        identity={"user_id": "dr_amara", "role": "doctor", "department": "cardiology", "purpose": "treatment"},
    )
    recovered_path = vault / "patient_chart.recovered.txt"
    recovered_path.write_bytes(result.data)
    show("decision", "GRANTED ✓")
    show("recovered file", str(recovered_path))
    show("byte-identical?", "YES ✓" if result.data == plaintext else "NO ✗")
    show("signed receipt", result.receipt.id)

    banner("④ ACCESS (denied) — wrong people, wrong reasons")
    for who, identity in [
        ("nurse, general ward", {"user_id": "nurse_bello", "role": "nurse", "department": "general"}),
        ("doctor, but for research", {"user_id": "dr_chen", "role": "doctor",
                                      "department": "cardiology", "purpose": "research"}),
    ]:
        try:
            privyq.access(sealed, identity=identity)
            show(who, "GRANTED ✗ (unexpected)")
        except PolicyViolationError as why:
            show(who, f"DENIED ✕  ({why})")

    banner("⑤ VERIFY — every access to this chart, provable")
    receipts = privyq.evidence.log(resource_id="chart_SGH-0042118")
    for r in receipts:
        mark = "✓" if r.result == "granted" else "✕"
        check = privyq.verify(r)
        print(f"    {mark} {r.result:<8} {r.actor:<12} op={r.operation:<8} verified={check.ok} chain_ok={check.chain_valid}")

    print(f"\n  Sealed + recovered files are in:  {vault}")


if __name__ == "__main__":
    try:
        main()
    except CoreUnreachableError:
        sys.exit(
            "\n✗ Could not reach the PrivyQ core.\n"
            "  Start it first:  cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd\n"
        )
