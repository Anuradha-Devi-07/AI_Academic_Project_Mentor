"""Readiness score — the same rules as assessSkills() in src/lib/skills.ts.

The server recomputes it on every profile save instead of trusting the score the browser sent.
"""
from datetime import datetime, timezone

from .schemas import SkillAssessment, SkillRating

_EXPERIENCE_POINTS = {"none": 0, "one": 12, "several": 25}


def _round(x: float) -> int:
    # JavaScript's Math.round (halves round up), not Python's banker's rounding.
    return int(x + 0.5) if x >= 0 else -int(-x + 0.5)


def assess_skills(skills: list[SkillRating], prior_projects: str, weekly_hours: int) -> SkillAssessment:
    skill_points = _round(min(1, sum(s.level for s in skills) / 12) * 60)
    time_points = min(15, max(0, _round(weekly_hours)))
    score = skill_points + _EXPERIENCE_POINTS[prior_projects] + time_points
    level = "advanced" if score >= 70 else "intermediate" if score >= 40 else "beginner"

    strengths = [s.skill for s in skills if s.level == 3]
    if not strengths:
        strengths = [s.skill for s in skills if s.level == 2][:3]

    categories = {s.category for s in skills}
    growth: list[str] = []
    if not any(s.skill == "Git" for s in skills):
        growth.append("Version control with Git — keeps a safe history of your project")
    if "data" not in categories:
        growth.append("Working with data (SQL or pandas)")
    if "web" not in categories and "design" not in categories:
        growth.append("Building a simple user interface")
    if prior_projects == "none":
        growth.append("Shipping a small end-to-end prototype early")
    if weekly_hours < 5:
        growth.append("Blocking out regular weekly time for the project")
    # Quiz results lower than the self-rating are the most useful thing to work on.
    overrated = [f"Strengthening your {s.skill} fundamentals" for s in skills if s.quiz and s.quiz.level < s.self_level]
    growth = overrated + growth

    verified = sum(1 for s in skills if s.quiz) / len(skills) if skills else 0
    return SkillAssessment(
        score=score,
        level=level,
        strengths=strengths,
        growth_areas=growth[:3],
        verified_share=verified,
        assessed_at=datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    )
