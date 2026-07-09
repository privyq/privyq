"""SDK configuration (ARCH §9.4, §20.3)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass
class Config:
    """Runtime configuration for the SDK client."""

    core_address: str = "localhost:50051"
    default_algorithm: str = "kyber_768"
    default_signature: str = "dilithium_3"
    timeout_seconds: int = 5
    audit_enabled: bool = True
    verify_evidence: bool = True
    tls: bool = False
    tls_ca: str | None = None

    @classmethod
    def from_env(cls) -> "Config":
        return cls(
            core_address=os.getenv("PRIVYQ_CORE_ADDRESS", "localhost:50051"),
            default_algorithm=os.getenv("PRIVYQ_ALGORITHM", "kyber_768"),
            default_signature=os.getenv("PRIVYQ_SIGNATURE", "dilithium_3"),
            timeout_seconds=int(os.getenv("PRIVYQ_TIMEOUT", "5")),
            audit_enabled=os.getenv("PRIVYQ_AUDIT", "true").lower() == "true",
        )


# Module-level configuration, mutated by configure().
_config = Config.from_env()


def configure(**kwargs) -> Config:
    """Update the global SDK configuration.

    Example::

        configure(core_address="localhost:50051", default_algorithm="kyber_768")
    """
    global _config
    for key, value in kwargs.items():
        if not hasattr(_config, key):
            raise AttributeError(f"unknown configuration option: {key!r}")
        setattr(_config, key, value)
    # A reconfiguration invalidates any cached client connection.
    from . import client as _client

    _client.reset_default_client()
    return _config


def get_config() -> Config:
    return _config
