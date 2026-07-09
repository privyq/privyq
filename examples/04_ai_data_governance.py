"""
Example 4 — AI / ML: Purpose-Bound Dataset Manifest (file) & Provenance
=======================================================================

THE PROBLEM
-----------
An ML team ships a training-dataset manifest file describing images collected
under research-only consent. The danger isn't theft — it's quiet repurposing
(reusing it to train a marketing model). And an auditor will later demand proof
of exactly who touched the dataset and for what.

WHAT THIS EXAMPLE DEMONSTRATES
------------------------------
  * Protecting a real JSON manifest file (`data/training_manifest.json`) into a
    sealed `.privyq` file.
  * A purpose-bound policy: the manifest decrypts ONLY for `purpose = research`,
    by an authorized role, inside the owning org.
  * The same sealed file refused for a "marketing" purpose (anti-repurposing),
    for an external org, and for an unauthorized role.
  * Using the signed, hash-chained evidence log as verifiable data lineage.

Run me:  python examples/04_ai_data_governance.py
"""
from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

import privyq
from privyq import CoreUnreachableError, PolicyViolationError

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "data" / "training_manifest.json"
RESOURCE = "dataset_derma_v4"


def banner(t: str) -> None:
    print(f"\n\033[1m{t}\033[0m\n" + "─" * len(t))


def show(label: str, value: str) -> None:
    print(f"  {label:<34} {value}")


def request(sealed: bytes, *, who: str, identity: dict) -> bytes | None:
    try:
        result = privyq.access(sealed, identity=identity)
        show(who, "GRANTED ✓")
        return result.data
    except PolicyViolationError as why:
        show(who, f"DENIED ✕  ({str(why).split('(')[0].strip()})")
        return None


def main() -> None:
    privyq.configure(core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"))
    vault = Path(tempfile.mkdtemp(prefix="privyq_ai_"))

    banner("① READ — the dataset manifest")
    plaintext = MANIFEST.read_bytes()
    meta = json.loads(plaintext)
    show("source file", f"{MANIFEST}  ({len(plaintext)} bytes)")
    show("dataset", meta["dataset"])
    show("samples", f"{meta['statistics']['num_samples']:,}")
    show("consent scope", meta["consent"]["scope"])
    show("prohibited uses", ", ".join(meta["consent"]["prohibited_uses"]))

    banner("② PROTECT — bind the manifest to its research consent")
    protected = privyq.protect(
        plaintext,
        policy={
            "purpose": "research",
            "organization": "AcmeAI",
            "role": ["ml-engineer", "data-scientist"],
        },
        resource_id=RESOURCE,
        actor={"user_id": "data_steward", "role": "data-scientist", "organization": "AcmeAI"},
    )
    sealed_path = vault / "training_manifest.json.privyq"
    sealed_path.write_bytes(protected.raw)
    show("sealed file", str(sealed_path))
    show("manifest leaked?", "NO ✓" if b"derma-lesions" not in sealed_path.read_bytes() else "YES ✗")

    banner("③ ACCESS — same sealed manifest, different intents")
    sealed = sealed_path.read_bytes()
    ok = request(sealed, who="ML engineer — research",
                 identity={"user_id": "eng_ada", "role": "ml-engineer", "organization": "AcmeAI", "purpose": "research"})
    request(sealed, who="ML engineer — marketing (repurpose)",
            identity={"user_id": "eng_ada", "role": "ml-engineer", "organization": "AcmeAI", "purpose": "marketing"})
    request(sealed, who="external data scientist — research",
            identity={"user_id": "ext_liu", "role": "data-scientist", "organization": "PartnerLabs", "purpose": "research"})
    request(sealed, who="product manager — research",
            identity={"user_id": "pm_ray", "role": "product-manager", "organization": "AcmeAI", "purpose": "research"})

    if ok is not None:
        out = vault / "training_manifest.recovered.json"
        out.write_bytes(ok)
        show("recovered manifest", f"{out.name}  (identical: {ok == plaintext})")

    banner("④ PROVENANCE — the evidence chain is the dataset's lineage")
    lineage = privyq.evidence.log(resource_id=RESOURCE)
    print(f"    {'ACTOR':<16}{'OP':<10}{'OUTCOME':<10}{'VERIFIED'}")
    intact = True
    for e in lineage:
        v = privyq.verify(e)
        intact = intact and v.ok
        print(f"    {e.actor:<16}{e.operation:<10}{e.result:<10}{v.ok}")
    show("\n  chain integrity", "INTACT ✓" if intact else "BROKEN ✕")
    print(f"\n  Sealed + recovered files in:  {vault}")


if __name__ == "__main__":
    try:
        main()
    except CoreUnreachableError:
        sys.exit(
            "\n✗ Could not reach the PrivyQ core.\n"
            "  Start it first:  cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd\n"
        )
