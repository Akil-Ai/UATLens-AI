"""
Project Access Control and Ownership Verification.

Enforces:
- Strict project ownership and explicit collaborator membership
- Distinction between application membership roles (owner, editor, viewer) and requirement business roles
- Prevention of unauthorized access via project ID guessing
- Preservation of legacy unassigned projects with explicit claim workflow
"""
from typing import Optional
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models.entities import Project, ProjectMember
from backend.app.core.auth import AuthUser, get_current_user


def check_project_access(
    project_id: str,
    user: AuthUser,
    db: Session,
    required_role: str = "viewer"
) -> Project:
    """
    Validates that user has authorized access to project_id.
    required_role: 'viewer' (read-only), 'editor' (generate/mutate), 'owner' (delete/transfer/manage)
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project '{project_id}' not found."
        )

    # Legacy project protection: Never grant access automatically to unowned legacy projects
    if project.owner_id is None:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This is a legacy unassigned project. It must be explicitly claimed by an authorized owner before access is granted."
        )

    # Check direct ownership
    if project.owner_id == user.id:
        return project

    # Check explicit project membership
    member = (
        db.query(ProjectMember)
        .filter(ProjectMember.project_id == project_id, ProjectMember.user_id == user.id)
        .first()
    )

    if member:
        if required_role == "viewer" and member.role in ("viewer", "editor", "owner"):
            return project
        if required_role == "editor" and member.role in ("editor", "owner"):
            return project
        if required_role == "owner" and member.role == "owner":
            return project

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access denied: You do not have permission to access this project."
    )


def get_project_viewer(
    project_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Project:
    return check_project_access(project_id, user, db, required_role="viewer")


def get_project_editor(
    project_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Project:
    return check_project_access(project_id, user, db, required_role="editor")


def get_project_owner(
    project_id: str,
    user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
) -> Project:
    return check_project_access(project_id, user, db, required_role="owner")
