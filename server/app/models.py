"""Database tables. Field meanings match src/types/models.ts in the frontend.

Nested data that is always read and written together (skills, assessment, pipeline steps,
agent results) is stored in JSON columns, which keeps the schema to a few tables.
"""
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, Column, Text
from sqlmodel import Field, SQLModel


def new_id(prefix: str) -> str:
    return f"{prefix}_{uuid4().hex}"


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: str = Field(default_factory=lambda: new_id("usr"), primary_key=True)
    name: str
    email: str = Field(unique=True, index=True)
    password_hash: str
    created_at: datetime = Field(default_factory=utcnow)


class LoginSession(SQLModel, table=True):
    """One row per issued token, so sign out and password reset can end sessions."""

    __tablename__ = "login_sessions"

    id: str = Field(default_factory=lambda: uuid4().hex, primary_key=True)
    user_id: str = Field(foreign_key="users.id", index=True)
    created_at: datetime = Field(default_factory=utcnow)
    expires_at: datetime


class StudentProfile(SQLModel, table=True):
    __tablename__ = "student_profiles"

    id: str = Field(default_factory=lambda: new_id("stu"), primary_key=True)
    user_id: str = Field(foreign_key="users.id", unique=True, index=True)
    name: str
    course: str
    year: str
    skills: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    prior_projects: str
    weekly_hours: int
    assessment: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON, nullable=False))
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Project(SQLModel, table=True):
    __tablename__ = "projects"

    id: str = Field(default_factory=lambda: new_id("prj"), primary_key=True)
    student_id: str = Field(foreign_key="student_profiles.id", index=True)
    title: str
    description: str = Field(sa_column=Column(Text, nullable=False))
    domain: str
    custom_domain: str | None = None
    duration_weeks: int
    latest_run_id: str | None = None
    created_at: datetime = Field(default_factory=utcnow)


class PipelineRun(SQLModel, table=True):
    __tablename__ = "pipeline_runs"

    id: str = Field(default_factory=lambda: new_id("run"), primary_key=True)
    project_id: str = Field(foreign_key="projects.id", index=True)
    status: str = "queued"
    steps: list[dict[str, Any]] = Field(default_factory=list, sa_column=Column(JSON, nullable=False))
    results: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    created_at: datetime = Field(default_factory=utcnow)
    finished_at: datetime | None = None
