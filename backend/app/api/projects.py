from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List, Optional
from backend.app.db.session import get_db
from backend.app.models.entities import Project, TestCase, Requirement, Flag, ProjectMember
from backend.app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectSummary
from backend.app.core.auth import AuthUser, get_current_user
from backend.app.core.project_access import (
    get_project_viewer,
    get_project_editor,
    get_project_owner,
)

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse)
def create_project(
    payload: ProjectCreate,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if len(payload.raw_text) > 65000:
        raise HTTPException(status_code=400, detail="Requirement text exceeds 60,000 character limit.")

    project = Project(
        name=payload.name,
        raw_text=payload.raw_text,
        owner_id=current_user.id,
        current_suite_version=1
    )
    db.add(project)
    db.flush()

    # Automatically add owner membership record
    owner_member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        user_email=current_user.email,
        role="owner"
    )
    db.add(owner_member)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[ProjectSummary])
def list_projects(
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # Only return projects owned by the user or where the user is an explicit member
    member_project_ids = (
        db.query(ProjectMember.project_id)
        .filter(ProjectMember.user_id == current_user.id)
        .scalar_subquery()
    )

    projects = (
        db.query(Project)
        .filter(
            (Project.owner_id == current_user.id) |
            (Project.id.in_(member_project_ids))
        )
        .order_by(Project.created_at.desc())
        .all()
    )

    summaries = []
    for p in projects:
        tc_count = db.query(TestCase).filter(TestCase.project_id == p.id).count()
        req_count = db.query(Requirement).filter(Requirement.project_id == p.id).count()
        flag_count = db.query(Flag).filter(Flag.project_id == p.id).count()
        summaries.append(
            ProjectSummary(
                id=p.id,
                name=p.name,
                created_at=p.created_at,
                updated_at=p.updated_at,
                test_case_count=tc_count,
                requirement_count=req_count,
                flag_count=flag_count,
            )
        )
    return summaries


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project: Project = Depends(get_project_viewer),
    db: Session = Depends(get_db)
):
    tc_count = db.query(TestCase).filter(TestCase.project_id == project.id).count()
    flag_count = db.query(Flag).filter(Flag.project_id == project.id).count()
    
    res = ProjectResponse.model_validate(project)
    res.test_case_count = tc_count
    res.flag_count = flag_count
    return res


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(
    payload: ProjectUpdate,
    project: Project = Depends(get_project_editor),
    db: Session = Depends(get_db)
):
    if payload.name is not None:
        project.name = payload.name
    if payload.raw_text is not None:
        if len(payload.raw_text) > 65000:
            raise HTTPException(status_code=400, detail="Requirement text exceeds 60,000 character limit.")
        project.raw_text = payload.raw_text
    if payload.parsed_structure is not None:
        project.parsed_structure = payload.parsed_structure

    db.commit()
    db.refresh(project)
    return project


@router.delete("/{project_id}")
def delete_project(
    project: Project = Depends(get_project_owner),
    db: Session = Depends(get_db)
):
    project_id = project.id
    db.delete(project)
    db.commit()
    return {"message": "Project and all associated artifacts deleted successfully.", "id": project_id}


@router.post("/{project_id}/claim-legacy")
def claim_legacy_project(
    project_id: str,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Explicitly claim an unassigned legacy project.
    Prevents unauthorized access while allowing authorized users to claim pre-migration data.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    if project.owner_id is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project already has an assigned owner."
        )

    project.owner_id = current_user.id
    member = ProjectMember(
        project_id=project.id,
        user_id=current_user.id,
        user_email=current_user.email,
        role="owner"
    )
    db.add(member)
    db.commit()
    db.refresh(project)

    return {
        "message": f"Project '{project.name}' successfully claimed.",
        "project_id": project.id,
        "owner_id": current_user.id
    }
