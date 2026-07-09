"""Gateway configuration (ARCH §20.2)."""
from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    core_address: str = "localhost:50051"
    secret_key: str = "change-me-jwt-signing-key"
    auth_enabled: bool = False
    rate_limit_per_sec: int = 100
    rate_limit_burst: int = 200
    version: str = "1.0.0"


settings = Settings()
