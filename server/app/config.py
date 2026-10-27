"""App settings, read from environment variables or server/.env."""
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./projectmentor.db"
    # No default on purpose: the server refuses to start without a signing secret.
    jwt_secret: str
    jwt_expire_hours: int = 24 * 7
    cors_origins: list[str] = ["http://localhost:5173"]
    allow_unverified_password_reset: bool = False


@lru_cache
def get_settings() -> Settings:
    return Settings()
