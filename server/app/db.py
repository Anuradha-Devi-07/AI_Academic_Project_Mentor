"""Database engine and per-request sessions. Works with PostgreSQL or SQLite (DATABASE_URL)."""
from collections.abc import Iterator
from functools import lru_cache

from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from .config import get_settings


@lru_cache
def get_engine():
    url = get_settings().database_url
    if url.startswith("sqlite"):
        # In-memory SQLite (used by the tests) must share one connection across threads.
        pool = {"poolclass": StaticPool} if url in ("sqlite://", "sqlite:///:memory:") else {}
        return create_engine(url, connect_args={"check_same_thread": False}, **pool)
    # Fail fast with a clear error if the database (docker compose) isn't running.
    return create_engine(url, pool_pre_ping=True, connect_args={"connect_timeout": 5})


def init_db() -> None:
    # Importing the models registers the tables on SQLModel.metadata.
    from . import models  # noqa: F401

    SQLModel.metadata.create_all(get_engine())


def get_session() -> Iterator[Session]:
    with Session(get_engine()) as session:
        yield session
