"""End-to-end SDK tests against a live privyqd core (the BP §25 scenario)."""

import pytest


def test_protect_access_verify(configured):
    privyq = configured
    protected = privyq.protect(
        "Patient: John Doe. Plan: continue beta-blocker.",
        {"role": "doctor", "department": "cardiology", "purpose": "treatment"},
        resource_id="patient_001",
        actor={"user_id": "dr_smith", "role": "doctor", "department": "cardiology"},
    )
    assert protected.key_id and protected.policy_hash

    # Authorized access decrypts and yields a verifiable receipt.
    result = privyq.access(
        protected,
        {"user_id": "dr_smith", "role": "doctor", "department": "cardiology", "purpose": "treatment"},
    )
    assert result.text.startswith("Patient: John Doe")
    assert result.receipt.result == "granted"

    check = privyq.verify(result.receipt)
    assert check.ok and check.signature_valid and check.chain_valid


def test_unauthorized_access_denied_but_logged(configured):
    privyq = configured
    protected = privyq.protect(
        "confidential",
        {"role": "doctor", "department": "cardiology"},
        resource_id="patient_002",
        actor={"user_id": "dr_smith", "role": "doctor"},
    )
    with pytest.raises(privyq.PolicyViolationError):
        privyq.access(protected, {"user_id": "nurse_jane", "role": "nurse", "department": "general"})

    # The denied attempt is still recorded in the evidence log.
    entries = privyq.evidence.log(resource_id="patient_002")
    assert any(e.result == "denied" and e.actor == "nurse_jane" for e in entries)


def test_expired_policy_denies(configured):
    privyq = configured
    protected = privyq.protect(
        "time-limited",
        {"role": "doctor", "expiry": "2000-01-01T00:00:00Z"},
        actor={"user_id": "dr_smith", "role": "doctor"},
    )
    with pytest.raises(privyq.PolicyViolationError):
        privyq.access(protected, {"role": "doctor"})


def test_key_generation(configured):
    privyq = configured
    key = privyq.generate_key(key_type="encryption", owner="dr_smith", organization="Hospital A")
    assert key.key_id and key.algorithm == "kyber_768" and key.status == "active"
