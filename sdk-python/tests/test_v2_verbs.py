"""v2 verbs end-to-end against the real core: check / explain / seal / verify / export."""

from __future__ import annotations


def test_check_and_explain(configured):
    privyq = configured
    protected = privyq.protect(b"patient record", {"role": "doctor"})

    granted = privyq.check({"role": "doctor"}, protected)
    assert granted.allowed and bool(granted) is True

    denied = privyq.check({"role": "nurse"}, protected)
    assert denied.allowed is False
    assert denied.reason and "role" in denied.failed
    assert privyq.explain(denied) == denied.reason


def test_check_with_explicit_policy(configured):
    privyq = configured
    policy = {"combination": "custom", "custom_logic": 'role == "manager" and amount <= approval_limit'}
    ok = privyq.check({"role": "manager", "attributes": {"amount": "500", "approval_limit": "1000"}}, policy=policy)
    assert ok.allowed
    no = privyq.check({"role": "manager", "attributes": {"amount": "5000", "approval_limit": "1000"}}, policy=policy)
    assert not no.allowed


def test_seal_and_verify_dispatch(configured):
    privyq = configured
    data = b"discharge summary - signed"
    sealed = privyq.seal(data)
    assert sealed.signature and sealed.algorithm and sealed.data_hash

    assert privyq.verify(sealed, data=data).ok is True
    assert privyq.verify(sealed, data=b"tampered").ok is False


def test_evidence_export(configured):
    privyq = configured
    privyq.protect(b"x", {"role": "doctor"})
    blob = privyq.evidence.export("csv")
    assert b"position" in blob
    pdf = privyq.evidence.export("pdf")
    assert pdf.startswith(b"%PDF")
