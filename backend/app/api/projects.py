from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from backend.app.db.session import get_db
from backend.app.models.entities import Project, TestCase, Requirement, Flag
from backend.app.schemas.project import ProjectCreate, ProjectUpdate, ProjectResponse, ProjectSummary

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.post("", response_model=ProjectResponse)
def create_project(payload: ProjectCreate, db: Session = Depends(get_db)):
    if len(payload.raw_text) > 65000:
        raise HTTPException(status_code=400, detail="Requirement text exceeds 60,000 character limit.")

    project = Project(name=payload.name, raw_text=payload.raw_text)
    db.add(project)
    db.commit()
    db.refresh(project)
    return project


@router.get("", response_model=List[ProjectSummary])
def list_projects(db: Session = Depends(get_db)):
    projects = db.query(Project).order_by(Project.created_at.desc()).all()
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
def get_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")
    
    tc_count = db.query(TestCase).filter(TestCase.project_id == project_id).count()
    flag_count = db.query(Flag).filter(Flag.project_id == project_id).count()
    
    res = ProjectResponse.model_validate(project)
    res.test_case_count = tc_count
    res.flag_count = flag_count
    return res


@router.patch("/{project_id}", response_model=ProjectResponse)
def update_project(project_id: str, payload: ProjectUpdate, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

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
def delete_project(project_id: str, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    db.delete(project)
    db.commit()
    return {"message": "Project and all associated artifacts deleted successfully.", "id": project_id}

# Commit ref: 46
