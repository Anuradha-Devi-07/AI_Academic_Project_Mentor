from fastapi import APIRouter, HTTPException, status
from sqlmodel import select

from ..assessment import assess_skills
from ..models import Project, StudentProfile, User, utcnow
from ..schemas import ProfileIn, ProfileOut, ProjectOut
from ..security import DB, CurrentUser

router = APIRouter(prefix="/students", tags=["students"])


def own_profile(db: DB, user: User, student_id: str) -> StudentProfile:
    profile = db.get(StudentProfile, student_id)
    # 404 (not 403) for someone else's profile, so IDs of other students can't be probed.
    if profile is None or profile.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Profile not found.")
    return profile


def _apply(profile: StudentProfile, body: ProfileIn) -> None:
    profile.name, profile.course, profile.year = body.name, body.course, body.year
    profile.skills = [s.model_dump(by_alias=True, exclude_none=True) for s in body.skills]
    profile.prior_projects, profile.weekly_hours = body.prior_projects, body.weekly_hours
    profile.assessment = assess_skills(body.skills, body.prior_projects, body.weekly_hours).model_dump(by_alias=True)
    profile.updated_at = utcnow()


@router.get("/me", response_model=ProfileOut)
def my_profile(user: CurrentUser, db: DB):
    """The signed-in student's profile (used after signing in on a new device)."""
    profile = db.exec(select(StudentProfile).where(StudentProfile.user_id == user.id)).first()
    if profile is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "You haven't created a profile yet.")
    return profile


@router.post("", response_model=ProfileOut)
def create_profile(body: ProfileIn, user: CurrentUser, db: DB):
    # One profile per account: if it already exists (e.g. created on another device), update it.
    profile = db.exec(select(StudentProfile).where(StudentProfile.user_id == user.id)).first()
    if profile is None:
        profile = StudentProfile(user_id=user.id, name=body.name, course=body.course, year=body.year, prior_projects=body.prior_projects, weekly_hours=body.weekly_hours)
    _apply(profile, body)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.put("/{student_id}", response_model=ProfileOut)
def update_profile(student_id: str, body: ProfileIn, user: CurrentUser, db: DB):
    profile = own_profile(db, user, student_id)
    _apply(profile, body)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{student_id}/projects", response_model=list[ProjectOut])
def list_projects(student_id: str, user: CurrentUser, db: DB):
    own_profile(db, user, student_id)
    return db.exec(select(Project).where(Project.student_id == student_id).order_by(Project.created_at.desc())).all()
