"""PrivyQ v2 — seal() a document, then export a compliance report.

Run a local core first, then:  python examples/python/02_seal_and_compliance.py
"""

import privyq

privyq.configure(core_address="localhost:50051")

# 1. Protect a record (policy-bound, post-quantum) and access it as a doctor.
record = b"Patient: Ada. Plan: continue beta-blocker."
protected = privyq.protect(record, {"role": "doctor", "purpose": "treatment"})

granted = privyq.check({"role": "doctor", "purpose": "treatment"}, protected)
print("Doctor may access:", granted.allowed, "-", granted.reason)
denied = privyq.check({"role": "nurse"}, protected)
print("Nurse may access:", denied.allowed, "-", denied.reason)

result = privyq.access(protected, {"role": "doctor", "purpose": "treatment"})
print("Decrypted:", result.data.decode())

# 2. seal() — a post-quantum signature over a discharge summary.
summary = b"Discharge summary for Ada, signed."
sealed = privyq.seal(summary)
print(f"\nSealed with {sealed.algorithm}; verifies: {privyq.verify(sealed, data=summary).ok}")
print("Tampered verifies:", privyq.verify(sealed, data=b'forged').ok)

# 3. Export the evidence trail for compliance (json/csv/pdf).
pdf = privyq.evidence.export("pdf")
with open("evidence-report.pdf", "wb") as fh:
    fh.write(pdf)
print(f"\nWrote evidence-report.pdf ({len(pdf)} bytes) — a verifiable audit report.")
