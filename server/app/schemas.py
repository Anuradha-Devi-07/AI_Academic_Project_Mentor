"""Request and response bodies. JSON keys are camelCase to match the frontend (src/types/models.ts)."""
from datetime import datetime, timezone
from typing import Annotated, Any, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, PlainSerializer, StringConstraints, field_validator, model_validator
from pydantic.alias_generators import to_camel


def _iso_utc(value: datetime) -> str:
    # SQLite returns naive datetimes; all stored times are UTC, so mark them as such.
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


ISODate = Annotated[datetime, PlainSerializer(_iso_utc, return_type=str)]
Proficiency = Literal[1, 2, 3]
Trimmed = Annotated[str, StringConstraints(strip_whitespace=True)]


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True, from_attributes=True)


# ── Accounts ────────────────────────────────────────────────────────────────

def _check_password(value: str) -> str:
    # Same rules as the register form in the frontend.
    if not any(c.isalpha() for c in value) or not any(c.isdigit() for c in value):
        raise ValueError("Include at least one letter and one number.")
    return value


class RegisterIn(CamelModel):
    name: Annotated[Trimmed, StringConstraints(min_length=2, max_length=50)]
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]

    _password = field_validator("password")(_check_password)


class LoginIn(CamelModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=1, max_length=128)]


class ResetPasswordIn(CamelModel):
    email: EmailStr
    password: Annotated[str, StringConstraints(min_length=8, max_length=128)]

    _password = field_validator("password")(_check_password)


class UserOut(CamelModel):
    id: str
    name: str
    email: str
    created_at: ISODate


class AuthSessionOut(CamelModel):
    user: UserOut
    token: str


# ── Student profile & skill assessment ─────────────────────────────────────

class SkillQuizResult(CamelModel):
    correct: int = Field(ge=0, le=10)
    total: int = Field(ge=1, le=10)
    level: Proficiency
    taken_at: str

    @model_validator(mode="after")
    def _correct_within_total(self):
        if self.correct > self.total:
            raise ValueError("Quiz correct answers can't be more than the total questions.")
        return self


class SkillRating(CamelModel):
    skill: Annotated[Trimmed, StringConstraints(min_length=1, max_length=40)]
    category: Literal["programming", "web", "data", "design", "tools"]
    level: Proficiency
    self_level: Proficiency
    quiz: SkillQuizResult | None = None


class SkillAssessment(CamelModel):
    score: int = Field(ge=0, le=100)
    level: Literal["beginner", "intermediate", "advanced"]
    strengths: list[str]
    growth_areas: list[str]
    verified_share: float = Field(ge=0, le=1)
    assessed_at: str


class ProfileIn(CamelModel):
    name: Annotated[Trimmed, StringConstraints(min_length=2, max_length=50)]
    course: Annotated[Trimmed, StringConstraints(min_length=2, max_length=80)]
    year: Annotated[Trimmed, StringConstraints(min_length=1, max_length=30)]
    skills: list[SkillRating] = Field(min_length=1, max_length=20)
    prior_projects: Literal["none", "one", "several"]
    weekly_hours: int = Field(ge=1, le=40)
    # The frontend sends its own assessment; the server recomputes it rather than trusting it.
    assessment: dict[str, Any] | None = None


class ProfileOut(CamelModel):
    id: str
    user_id: str
    name: str
    course: str
    year: str
    skills: list[SkillRating]
    prior_projects: str
    weekly_hours: int
    assessment: SkillAssessment
    created_at: ISODate
    updated_at: ISODate


# ── Projects & pipeline runs ───────────────────────────────────────────────

class ProjectIn(CamelModel):
    student_id: str
    title: Annotated[Trimmed, StringConstraints(min_length=3, max_length=80)]
    description: Annotated[Trimmed, StringConstraints(min_length=30, max_length=1000)]
    domain: Literal["ai_ml", "web", "mobile", "iot", "data", "other"]
    custom_domain: Annotated[Trimmed, StringConstraints(max_length=40)] | None = None
    duration_weeks: int = Field(ge=4, le=24)

    @field_validator("custom_domain")
    @classmethod
    def _blank_is_none(cls, value: str | None) -> str | None:
        return value or None


class ProjectOut(CamelModel):
    id: str
    student_id: str
    title: str
    description: str
    domain: str
    custom_domain: str | None = None
    duration_weeks: int
    created_at: ISODate
    latest_run_id: str | None = None


class AgentStep(CamelModel):
    agent_id: str
    status: Literal["queued", "running", "completed", "failed"]
    started_at: str | None = None
    finished_at: str | None = None
    summary: str | None = None
    error: str | None = None


class PipelineRunOut(CamelModel):
    id: str
    project_id: str
    status: Literal["queued", "running", "completed", "failed"]
    steps: list[AgentStep]
    created_at: ISODate
    finished_at: ISODate | None = None
    results: dict[str, Any] | None = None
