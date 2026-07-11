"""PrivyQ v2 — the PDP `check()` verb: describe policies, don't write authorization code.

Run a local core first:  cd core-go && make build && ./privyqd
Then:                     python examples/python/01_pdp_check.py

Shows the banking approval-limit scenario with break-glass — the kind of `if`
ladder PrivyQ replaces, expressed as one policy and one `check()`.
"""

import privyq

privyq.configure(core_address="localhost:50051")

# One policy, written once — instead of a pile of `if` statements per endpoint.
policy = {
    "combination": "custom",
    "custom_logic": 'role == "manager" and (amount <= approval_limit or emergency)',
}


def can_approve(user: dict) -> None:
    decision = privyq.check(user, policy=policy)
    who = user.get("user_id", user["role"])
    if decision.allowed:
        print(f"  ✅ {who}: APPROVED")
    else:
        # decision.reason is a human-readable explanation — perfect for a 403 body.
        print(f"  ❌ {who}: DENIED — {privyq.explain(decision)}  (failed: {decision.failed})")


print("Loan approval decisions (no authorization code, just a policy):")
can_approve({"user_id": "amaka", "role": "manager", "attributes": {"amount": "500000", "approval_limit": "1000000"}})
can_approve({"user_id": "bello", "role": "manager", "attributes": {"amount": "5000000", "approval_limit": "1000000"}})
can_approve({"user_id": "chidi", "role": "manager", "attributes": {"amount": "5000000", "approval_limit": "1000000", "emergency": "true"}})
can_approve({"user_id": "dara", "role": "clerk", "attributes": {"amount": "1", "approval_limit": "100"}})
