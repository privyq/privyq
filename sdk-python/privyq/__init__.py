"""PrivyQ — post-quantum, policy-governed encryption with verifiable evidence.

Intention-based API (BP §11):

    from privyq import protect, access, verify, configure

    configure(core_address="localhost:50051")
    protected = protect(b"secret", {"role": "doctor", "expiry": "24h"})
    result = access(protected, {"role": "doctor"})
    print(result.text, verify(result.receipt).ok)
"""

from __future__ import annotations

from . import evidence
from .access import access
from .config import Config, configure, get_config
from .exceptions import (
    ConditionFailedError,
    ConnectionError_,
    CoreUnreachableError,
    CryptoError,
    DecryptionFailedError,
    ExpiredError,
    KeyNotFoundError,
    KeyRevokedError,
    KeyRotationError,
    PolicyViolationError,
    PrivyQError,
    SignatureVerificationError,
)
from .keys import generate_key, get_key, revoke_key, rotate_key
from .models import AccessResult, ProtectedData, Receipt, VerificationResult
from .protect import protect
from .verify import verify

__version__ = "1.0.0"

__all__ = [
    "protect",
    "access",
    "verify",
    "evidence",
    "configure",
    "get_config",
    "Config",
    "generate_key",
    "get_key",
    "rotate_key",
    "revoke_key",
    "ProtectedData",
    "AccessResult",
    "Receipt",
    "VerificationResult",
    "PrivyQError",
    "PolicyViolationError",
    "ConditionFailedError",
    "ExpiredError",
    "KeyNotFoundError",
    "KeyRevokedError",
    "KeyRotationError",
    "CryptoError",
    "DecryptionFailedError",
    "SignatureVerificationError",
    "ConnectionError_",
    "CoreUnreachableError",
    "__version__",
]
