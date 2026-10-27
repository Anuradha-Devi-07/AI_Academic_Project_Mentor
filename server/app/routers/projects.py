from fastapi import APIRouter, HTTPException, Response, status
from sqlmodel import delete

from ..models import PipelineRun, Project, StudentProfile, User
from ..pipeline import new_run
from ..schemas import PipelineRunOut, ProjectIn, ProjectOut
from ..security import DB, CurrentUser
from .students import own_profile

router = APIRouter(tags=["projects"])


def own_project(db: DB, user: User, project_id: str) -> Project:
    project = db.get(Project, project_id)
    profile = db.get(StudentProfile, project.student_id) if project else None
    if project is None or profile is None or profile.user_id != user.id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Project not found.")
    return project


@router.post("/projects", response_model=ProjectOut, status_code=status.HTTP_201_CREATED)
def create_project(body: ProjectIn, user: CurrentUser, db: DB):
    own_profile(db, user, body.student_id)
    if body.domain == "other" and (body.custom_domain is None or len(body.custom_domain) < 2):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Type what kind of project it is, e.g. Cybersecurity.")
    project = Project(**body.model_dump(exclude={"custom_domain"}), custom_domain=body.custom_domain if body.domain == "other" else None)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("/projects/{project_id}", response_model=ProjectOut)
def get_project(project_id: str, user: CurrentUser, db: DB):
    return own_project(db, user, project_id)


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(project_id: str, user: CurrentUser, db: DB):
    project = own_project(db, user, project_id)
    db.exec(delete(PipelineRun).where(PipelineRun.project_id == project.id))
    db.delete(project)
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/projects/{project_id}/pipeline-runs", response_model=PipelineRunOut, status_code=status.HTTP_201_CREATED)
def trigger_pipeline(project_id: str, user: CurrentUser, db: DB):
    """The pipeline trigger: creates a queued run. The agents (Milestone 2) will pick it up."""
    project = own_project(db, user, project_id)
    run = new_run(project.id)
    project.latest_run_id = run.id
    db.add(run)
    db.add(project)
    db.commit()
    db.refresh(run)
    return run


@router.get("/pipeline-runs/{run_id}", response_model=PipelineRunOut)
def get_pipeline_run(run_id: str, user: CurrentUser, db: DB):
    run = db.get(PipelineRun, run_id)
    if run is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Pipeline run not found.")
    own_project(db, user, run.project_id)
    return run
