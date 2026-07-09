"""PrivyQ SDK quickstart — the medical-records scenario (BP §25).

Run a core first:  (cd ../../core-go && KEY_STORAGE=memory go run ./cmd/privyqd)
Then:              python quickstart.py
"""
import privyq

privyq.configure(core_address="localhost:50051")

record = "Patient: John Doe (58). Echo: mild LV hypertrophy. Plan: continue beta-blocker."

# 1. Protect — the rules travel inside the ciphertext.
protected = privyq.protect(
    record,
    policy={
        "role": "doctor",
        "department": "cardiology",
        "purpose": "treatment",
        "expiry": "24h",
    },
    resource_id="patient_001",
    actor={"user_id": "dr_smith", "role": "doctor", "department": "cardiology"},
)
print(f"protected under key {protected.key_id} (policy {protected.policy_hash[:12]}…)")

# 2. Authorized access — the cardiologist can read it.
result = privyq.access(
    protected,
    identity={"user_id": "dr_smith", "role": "doctor", "department": "cardiology", "purpose": "treatment"},
)
print("GRANTED:", result.text)
print("receipt:", result.receipt.id)

# 3. Unauthorized access — a nurse cannot, but the attempt is recorded.
try:
    privyq.access(protected, identity={"user_id": "nurse_jane", "role": "nurse", "department": "general"})
except privyq.PolicyViolationError as why:
    print("DENIED:", why)

# 4. Verify the tamper-proof evidence chain.
for receipt in privyq.evidence.log(resource_id="patient_001"):
    check = privyq.verify(receipt)
    print(f"  {receipt.actor:12} {receipt.result:8} verified={check.ok}")
