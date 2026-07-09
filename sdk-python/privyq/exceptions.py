"""PrivyQ SDK exception hierarchy (ARCH §9.3).

gRPC status codes from the core are mapped onto these exceptions so that
application code can catch meaningful, intention-level errors.
"""

from __future__ import annotations


class PrivyQError(Exception):
    """Base class for all PrivyQ errors."""


# ── policy ──
class PolicyViolationError(PrivyQError):
    """Access was denied because the embedded policy was not satisfied."""


class ConditionFailedError(PolicyViolationError):
    """A specific policy condition failed."""


class ExpiredError(PolicyViolationError):
    """The policy's validity window has passed."""


# ── keys ──
class KeyError_(PrivyQError):
    """Base class for key-related errors."""


class KeyNotFoundError(KeyError_):
    """The referenced key does not exist."""


class KeyRevokedError(KeyError_):
    """The referenced key has been revoked."""


class KeyRotationError(KeyError_):
    """A key rotation operation failed."""


# ── crypto ──
class CryptoError(PrivyQError):
    """Base class for cryptographic failures."""


class DecryptionFailedError(CryptoError):
    """Decryption or authentication of the ciphertext failed."""


class SignatureVerificationError(CryptoError):
    """A signature failed to verify."""


# ── connection ──
class ConnectionError_(PrivyQError):
    """Base class for connectivity errors."""


class CoreUnreachableError(ConnectionError_):
    """The cryptographic core could not be reached."""


class TimeoutError_(ConnectionError_):
    """A request to the core timed out."""
