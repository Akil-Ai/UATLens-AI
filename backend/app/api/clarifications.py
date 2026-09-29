"""
API endpoints for the Requirement Clarification Workflow.

GET  /api/clarifications/{project_id}   — list all decisions for project
POST /api/clarifications/{project_id}/sync — sync ambiguities from context → decisions
PATCH /api/clarifications/{project_id}/{decision_id} — update a single decision
DELETE /api/clarifications/{project_id} — clear all decisions (on re-extraction)
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from pydantic import BaseModel
import uuid
from datetime import datetime, timezone

from backend.app.db.session import get_db
from backend.app.models.entities import Project, ExtractedContext, ClarificationDecision

router = APIRouter(tags=["Clarifications"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class ClarificationDecisionResponse(BaseModel):
    id: str
    project_id: str
    requirement_id: Optional[str] = None
    issue_type: str
    description: str
    suggested_question: str
    decision: str          # pending | accepted | rejected | answered
    reviewer_answer: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class UpdateDecisionPayload(BaseModel):
    decision: str          # accepted | rejected | answered
    reviewer_answer: Optional[str] = None


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/clarifications/{project_id}", response_model=List[ClarificationDecisionResponse])
def list_clarification_decisions(project_id: str, db: Session = Depends(get_db)):
    """Return all persisted clarification decisions for a project."""
    decisions = (
        db.query(ClarificationDecision)
        .filter(ClarificationDecision.project_id == project_id)
        .order_by(ClarificationDecision.created_at.asc())
        .all()
    )
    return decisions


@router.post("/clarifications/{project_id}/sync", response_model=List[ClarificationDecisionResponse])
def sync_clarification_decisions(project_id: str, db: Session = Depends(get_db)):
    """
    Synchronise ClarificationDecision rows with the ambiguities stored in
    ExtractedContext.  New ambiguities become 'pending' rows; existing rows
    with a user decision are preserved.  Removed ambiguities are deleted.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project_id).first()
    if not ctx or not ctx.ambiguities:
        # No context or no ambiguities → clear decisions
        db.query(ClarificationDecision).filter(
            ClarificationDecision.project_id == project_id
        ).delete(synchronize_session=False)
        db.commit()
        return []

    ambiguities = ctx.ambiguities  # list of dicts

    existing = {
        (d.requirement_id, d.issue_type, d.description[:80]): d
        for d in db.query(ClarificationDecision)
        .filter(ClarificationDecision.project_id == project_id)
        .all()
    }

    kept_keys = set()
    result = []

    for amb in ambiguities:
        req_id = amb.get("requirement_id")
        issue_type = amb.get("issue_type", "")
        description = amb.get("description", "")
        suggested_question = amb.get("suggested_question", "")

        key = (req_id, issue_type, description[:80])
        kept_keys.add(key)

        if key in existing:
            # Preserve existing decision
            result.append(existing[key])
        else:
            # Create a new pending decision
            new_dec = ClarificationDecision(
                id=str(uuid.uuid4()),
                project_id=project_id,
                requirement_id=req_id,
                issue_type=issue_type,
                description=description,
                suggested_question=suggested_question,
                decision="pending",
            )
            db.add(new_dec)
            result.append(new_dec)

    # Delete decisions for ambiguities that no longer exist
    for key, dec in existing.items():
        if key not in kept_keys:
            db.delete(dec)

    db.commit()
    for r in result:
        db.refresh(r)

    return result


@router.patch(
    "/clarifications/{project_id}/{decision_id}",
    response_model=ClarificationDecisionResponse
)
def update_clarification_decision(
    project_id: str,
    decision_id: str,
    payload: UpdateDecisionPayload,
    db: Session = Depends(get_db),
):
    """Record the reviewer's decision (accept / reject / answer) on an ambiguity."""
    dec = db.query(ClarificationDecision).filter(
        ClarificationDecision.id == decision_id,
        ClarificationDecision.project_id == project_id,
    ).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Clarification decision not found.")

    allowed = {"accepted", "rejected", "answered", "pending"}
    if payload.decision not in allowed:
        raise HTTPException(
            status_code=422,
            detail=f"decision must be one of {sorted(allowed)}"
        )

    dec.decision = payload.decision
    dec.reviewer_answer = payload.reviewer_answer
    dec.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(dec)
    return dec


@router.delete("/clarifications/{project_id}", status_code=204)
def delete_clarification_decisions(project_id: str, db: Session = Depends(get_db)):
    """Clear all clarification decisions for a project (called on re-extraction)."""
    db.query(ClarificationDecision).filter(
        ClarificationDecision.project_id == project_id
    ).delete(synchronize_session=False)
    db.commit()
