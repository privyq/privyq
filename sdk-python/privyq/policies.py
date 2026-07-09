"""Policy helpers: turn friendly Python dicts into the wire Policy message.

Two input forms are accepted (BP §11.2 shows both):

1. **Structured** — an explicit condition list::

       {"conditions": [{"type": "role", "operator": "equals", "value": "doctor"}],
        "combination": "all"}

2. **Shorthand** — a flat mapping, where each key is a condition. Lists become
   ``in`` conditions, ``expiry`` becomes a ``before`` condition, and a duration
   like ``"24h"`` is expanded to an absolute timestamp::

       {"role": "doctor", "department": ["cardiology", "oncology"], "expiry": "24h"}
"""

from __future__ import annotations

import re
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from ._proto import privyq_pb2 as pb

_DURATION = re.compile(r"^(\d+)([smhd])$")
_UNIT = {"s": "seconds", "m": "minutes", "h": "hours", "d": "days"}


def _expand_expiry(value: str) -> str:
    """Expand a duration (e.g. '24h') to an absolute RFC3339 timestamp; pass
    through anything that already looks like a date/time."""
    m = _DURATION.match(value)
    if not m:
        return value
    amount, unit = int(m.group(1)), m.group(2)
    when = datetime.now(timezone.utc) + timedelta(**{_UNIT[unit]: amount})
    return when.strftime("%Y-%m-%dT%H:%M:%SZ")


def _condition(type_: str, operator: str, values: list[str], negate: bool = False) -> pb.Condition:
    return pb.Condition(type=type_, operator=operator, values=[str(v) for v in values], negate=negate)


def _shorthand_condition(key: str, value: Any) -> pb.Condition:
    if key in ("expiry", "valid_until"):
        return _condition(key, "before", [_expand_expiry(str(value))])
    if key == "valid_from":
        return _condition(key, "after", [str(value)])
    if isinstance(value, (list, tuple)):
        return _condition(key, "in", list(value))
    return _condition(key, "equals", [value])


def to_proto_policy(policy: Mapping[str, Any] | None) -> pb.Policy:
    """Normalize a policy mapping into a :class:`pb.Policy`."""
    if policy is None:
        return pb.Policy(version="1.0", combination="all")

    if "conditions" in policy:
        conds = []
        for c in policy["conditions"]:
            values = c.get("values")
            if values is None:
                v = c.get("value")
                values = v if isinstance(v, (list, tuple)) else [v]
            conds.append(
                _condition(c["type"], c.get("operator", "equals"), list(values), c.get("negate", False))
            )
        return pb.Policy(
            version=str(policy.get("version", "1.0")),
            conditions=conds,
            combination=policy.get("combination", "all"),
            custom_logic=policy.get("custom_logic", ""),
            metadata={str(k): str(v) for k, v in policy.get("metadata", {}).items()},
        )

    # Shorthand form.
    reserved = {"combination", "version", "metadata"}
    conds = [_shorthand_condition(k, v) for k, v in policy.items() if k not in reserved]
    return pb.Policy(
        version=str(policy.get("version", "1.0")),
        conditions=conds,
        combination=policy.get("combination", "all"),
    )


def to_proto_identity(identity: Mapping[str, Any] | None) -> pb.Identity:
    """Turn an identity mapping into a :class:`pb.Identity`. Unknown keys are
    carried in the free-form ``attributes`` map."""
    identity = dict(identity or {})
    known = {"user_id", "role", "department", "purpose", "organization", "classification", "jurisdiction"}
    attributes = {str(k): str(v) for k, v in identity.items() if k not in known}
    return pb.Identity(
        user_id=identity.get("user_id", ""),
        role=identity.get("role", ""),
        department=identity.get("department", ""),
        purpose=identity.get("purpose", ""),
        organization=identity.get("organization", ""),
        classification=identity.get("classification", ""),
        jurisdiction=identity.get("jurisdiction", ""),
        attributes=attributes,
    )
