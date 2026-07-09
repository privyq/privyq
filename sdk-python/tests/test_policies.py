"""Unit tests for policy/identity normalization (no core required)."""

from privyq.policies import to_proto_identity, to_proto_policy


def test_shorthand_scalar():
    p = to_proto_policy({"role": "doctor"})
    assert len(p.conditions) == 1
    c = p.conditions[0]
    assert c.type == "role" and c.operator == "equals" and list(c.values) == ["doctor"]


def test_shorthand_list_becomes_in():
    p = to_proto_policy({"department": ["cardiology", "oncology"]})
    c = p.conditions[0]
    assert c.operator == "in" and list(c.values) == ["cardiology", "oncology"]


def test_shorthand_expiry_duration_expands():
    p = to_proto_policy({"expiry": "24h"})
    c = p.conditions[0]
    assert c.type == "expiry" and c.operator == "before"
    assert c.values[0].endswith("Z") and "T" in c.values[0]


def test_structured_form_passthrough():
    p = to_proto_policy(
        {
            "conditions": [{"type": "role", "operator": "in", "value": ["doctor", "nurse"]}],
            "combination": "any",
        }
    )
    assert p.combination == "any"
    assert list(p.conditions[0].values) == ["doctor", "nurse"]


def test_identity_unknown_keys_go_to_attributes():
    ident = to_proto_identity({"role": "doctor", "location": "hospital_a", "device_type": "workstation"})
    assert ident.role == "doctor"
    assert ident.attributes["location"] == "hospital_a"
    assert ident.attributes["device_type"] == "workstation"


def test_none_policy_defaults():
    p = to_proto_policy(None)
    assert p.combination == "all" and len(p.conditions) == 0
