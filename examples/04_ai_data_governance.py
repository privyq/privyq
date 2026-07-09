"""
Example 4 — AI / ML: Purpose-Bound Training Data & Provenance
=============================================================

THE PROBLEM
-----------
An ML team curates a sensitive training dataset (say, labeled medical images).
It was collected under consent for **research only**. The risk isn't just theft —
it's *repurposing*: someone inside the company quietly reusing it to train a
marketing model, violating the consent under which it was gathered. And when an
auditor later asks "prove exactly who touched this dataset and for what," a plain
access log won't cut it — logs can be edited.

HOW PrivyQ SOLVES IT
--------------------
The dataset is `protect()`-ed with a **purpose-bound** policy: it can be opened
only for `purpose = research`, by an authorized role, inside the owning org. An
attempt to access it "for marketing" is refused at the cryptographic layer — the
data literally will not decrypt for the wrong purpose.

And because every access (allowed or refused) is a signed, hash-chained receipt,
the evidence log *is* the dataset's provenance — a tamper-evident lineage record
you can hand to an auditor.

WHAT THIS EXAMPLE DEMONSTRATES
------------------------------
  * Purpose limitation as an enforced cryptographic control (anti-repurposing)
  * Organization + role scoping
  * Using the evidence chain as verifiable data lineage / provenance

Run me:  python examples/04_ai_data_governance.py
"""
from __future__ import annotations

import os
import sys

import privyq
from privyq import CoreUnreachableError, PolicyViolationError


def banner(title: str) -> None:
    print(f"\n\033[1m{title}\033[0m\n" + "─" * len(title))


def show(label: str, value: str) -> None:
    print(f"  {label:<30} {value}")


def request(protected, *, who: str, identity: dict) -> None:
    try:
        result = privyq.access(protected, identity=identity)
        show(who, f"GRANTED ✓  →  {result.text[:44]}…")
    except PolicyViolationError as why:
        show(who, f"DENIED ✕  ({why})")


def main() -> None:
    privyq.configure(core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"))

    banner("① PROTECT — seal a dataset for research use, inside AcmeAI only")
    dataset_manifest = (
        "dataset://derma-lesions-v4  · 84,120 consented images · "
        "consent scope: RESEARCH ONLY · PII: removed"
    )

    protected = privyq.protect(
        dataset_manifest,
        policy={
            "purpose": "research",                          # the binding consent scope
            "organization": "AcmeAI",                       # never leaves the org
            "role": ["ml-engineer", "data-scientist"],      # authorized handlers
        },
        resource_id="dataset_derma_v4",
        actor={"user_id": "data_steward", "role": "data-scientist", "organization": "AcmeAI"},
    )
    show("protected dataset", "dataset_derma_v4")
    show("bound purpose", "research (enforced at decryption)")

    banner("② ACCESS attempts — the same dataset, different intents")

    # (a) Legitimate research use by an ML engineer at AcmeAI → granted.
    request(
        protected,
        who="ML engineer, for research",
        identity={"user_id": "eng_ada", "role": "ml-engineer", "organization": "AcmeAI", "purpose": "research"},
    )

    # (b) The SAME engineer, now trying to reuse it to train a marketing model →
    #     purpose limitation refuses to decrypt. This is the anti-repurposing win.
    request(
        protected,
        who="ML engineer, for marketing",
        identity={"user_id": "eng_ada", "role": "ml-engineer", "organization": "AcmeAI", "purpose": "marketing"},
    )

    # (c) A data scientist at a partner company, even for research → org scope denies.
    request(
        protected,
        who="external data scientist (research)",
        identity={"user_id": "ext_liu", "role": "data-scientist", "organization": "PartnerLabs", "purpose": "research"},
    )

    # (d) A product manager (unauthorized role) at AcmeAI → role denies.
    request(
        protected,
        who="product manager (research)",
        identity={"user_id": "pm_ray", "role": "product-manager", "organization": "AcmeAI", "purpose": "research"},
    )

    banner("③ PROVENANCE — the evidence chain is the dataset's lineage")
    lineage = privyq.evidence.log(resource_id="dataset_derma_v4")
    print(f"  {len(lineage)} lineage event(s) for dataset_derma_v4:\n")
    print(f"    {'ACTOR':<16}{'INTENT/OP':<14}{'OUTCOME':<10}{'VERIFIED'}")
    all_ok = True
    for e in lineage:
        check = privyq.verify(e)
        all_ok = all_ok and check.ok
        print(f"    {e.actor:<16}{e.operation:<14}{e.result:<10}{check.ok}")
    show("\n  full chain integrity", "INTACT ✓" if all_ok else "BROKEN ✕")
    print(
        "\n  Purpose limitation turns 'please don't misuse this' into a rule the data\n"
        "  itself enforces — and the signed lineage proves the rule held."
    )


if __name__ == "__main__":
    try:
        main()
    except CoreUnreachableError:
        sys.exit(
            "\n✗ Could not reach the PrivyQ core.\n"
            "  Start it first:  cd core-go && KEY_STORAGE=memory go run ./cmd/privyqd\n"
        )
