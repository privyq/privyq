"""End-to-end v2 flow through SDK -> core -> Postgres (testcontainers).

Exercises the whole stack against a real database: protect, the PDP check
(granted & denied, no data revealed), authorized/denied access, evidence verify,
seal/verify, and a compliance PDF export — all persisted through Postgres.
"""

from __future__ import annotations

import pytest


def test_full_v2_flow_over_postgres(stack):
    privyq = stack

    # 1. Protect a record with a policy bound to the ciphertext.
    protected = privyq.protect(b"patient record: Ada", {"role": "doctor", "purpose": "treatment"})

    # 2. PDP check — decision only, nothing revealed.
    granted = privyq.check({"role": "doctor", "purpose": "treatment"}, protected)
    assert granted.allowed and bool(granted)
    denied = privyq.check({"role": "nurse"}, protected)
    assert not denied.allowed and denied.reason and "role" in denied.failed
    assert privyq.explain(denied) == denied.reason

    # 3. Authorized access decrypts and yields a verifiable receipt.
    result = privyq.access(protected, {"role": "doctor", "purpose": "treatment"})
    assert result.data == b"patient record: Ada"
    assert privyq.verify(result.receipt).ok

    # 4. Unauthorized access is denied — but still recorded.
    with pytest.raises(privyq.PolicyViolationError):
        privyq.access(protected, {"role": "nurse"})

    # 5. seal()/verify() — post-quantum signature over a document.
    doc = b"discharge summary, signed"
    sealed = privyq.seal(doc)
    assert privyq.verify(sealed, data=doc).ok
    assert not privyq.verify(sealed, data=b"forged").ok

    # 6. The evidence trail (persisted in Postgres) is queryable and exportable.
    entries = privyq.evidence.log(page_size=100)
    assert len(entries) >= 3  # protect + granted access + denied access (+ checks)
    pdf = privyq.evidence.export("pdf")
    assert pdf.startswith(b"%PDF")
