"""
API endpoints for the Durable Requirement Clarification Workflow.

Lifecycle:
  Open → Answered → Resolved
  Or Dismissed (requires mandatory reason)
  Reopen returns to Open with audit history

Downstream impact:
  Answering or resolving a clarification marks affected test cases stale.
  Selective regeneration restores only affected tests.
"""
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
import uuid
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict, Field

from backend.app.db.session import get_db
from backend.app.models.entities import Project, ExtractedContext, ClarificationDecision, TestCase, Flag
from backend.app.core.auth import AuthUser, get_current_user
from backend.app.core.project_access import get_project_viewer, get_project_editor

router = APIRouter(tags=["Clarifications"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class ClarificationDecisionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    requirement_id: Optional[str] = None
    issue_type: str
    description: str
    suggested_question: str
    source_evidence: Optional[str] = None
    document_location: Optional[str] = None
    status: str                        # Open | Answered | Resolved | Dismissed
    decision: str                      # legacy compatibility: pending | answered | accepted | rejected
    reviewer_answer: Optional[str] = None
    dismissal_reason: Optional[str] = None
    answered_by: Optional[str] = None
    answered_at: Optional[datetime] = None
    confirmed_by: Optional[str] = None
    confirmed_at: Optional[datetime] = None
    dismissed_by: Optional[str] = None
    dismissed_at: Optional[datetime] = None
    reopened_by: Optional[str] = None
    reopened_at: Optional[datetime] = None
    history: Optional[List[Dict[str, Any]]] = None
    is_superseded: bool = False
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class AnswerPayload(BaseModel):
    answer: str = Field(..., min_length=1, description="Authoritative answer to clarification question")


class DismissPayload(BaseModel):
    reason: str = Field(..., min_length=1, description="Mandatory reason for dismissing finding")


class UpdateDecisionPayload(BaseModel):
    status: Optional[str] = None       # Open | Answered | Resolved | Dismissed
    decision: Optional[str] = None     # legacy
    reviewer_answer: Optional[str] = None
    dismissal_reason: Optional[str] = None


# ── Helper to invalidate affected test cases ──────────────────────────────────

def _mark_affected_tests_stale(project_id: str, requirement_id: Optional[str], db: Session) -> int:
    """Marks tests associated with the clarified requirement as stale."""
    if not requirement_id:
        return 0
    cases = (
        db.query(TestCase)
        .filter(TestCase.project_id == project_id, TestCase.requirement_id == requirement_id)
        .all()
    )
    count = 0
    for tc in cases:
        tc.is_stale = True
        count += 1
    return count


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/clarifications/{project_id}", response_model=List[ClarificationDecisionResponse])
def list_clarification_decisions(
    include_superseded: bool = False,
    project: Project = Depends(get_project_viewer),
    db: Session = Depends(get_db)
):
    """Return all persisted clarification decisions for a project."""
    query = db.query(ClarificationDecision).filter(ClarificationDecision.project_id == project.id)
    if not include_superseded:
        query = query.filter(ClarificationDecision.is_superseded == False)
    decisions = query.order_by(ClarificationDecision.created_at.asc()).all()
    return decisions


@router.post("/clarifications/{project_id}/sync", response_model=List[ClarificationDecisionResponse])
def sync_clarification_decisions(
    project: Project = Depends(get_project_editor),
    db: Session = Depends(get_db)
):
    """
    Synchronises ambiguities with ClarificationDecision rows idempotently.
    Never deletes existing decisions. If a finding is absent, marks is_superseded=True.
    """
    project_id = project.id
    ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project_id).first()
    ambiguities = (ctx.ambiguities or []) if ctx else []

    existing = {
        (d.requirement_id, d.issue_type, d.description[:60].strip().lower()): d
        for d in db.query(ClarificationDecision)
        .filter(ClarificationDecision.project_id == project_id)
        .all()
    }

    seen_keys = set()
    result = []

    for amb in ambiguities:
        req_id = amb.get("requirement_id")
        issue_type = amb.get("issue_type", "Ambiguity")
        description = amb.get("description", "")
        suggested_question = amb.get("suggested_question", "")

        key = (req_id, issue_type, description[:60].strip().lower())
        seen_keys.add(key)

        if key in existing:
            dec = existing[key]
            dec.is_superseded = False
            result.append(dec)
        else:
            new_dec = ClarificationDecision(
                id=str(uuid.uuid4()),
                project_id=project_id,
                requirement_id=req_id,
                issue_type=issue_type,
                description=description,
                suggested_question=suggested_question,
                status="Open",
                decision="pending",
                history=[{
                    "action": "created",
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                    "note": "Extracted from context"
                }]
            )
            db.add(new_dec)
            result.append(new_dec)

    # Mark remaining unreferenced decisions as superseded (never delete!)
    for key, dec in existing.items():
        if key not in seen_keys:
            dec.is_superseded = True
            result.append(dec)

    db.commit()
    for r in result:
        db.refresh(r)

    return [r for r in result if not r.is_superseded]


@router.post(
    "/clarifications/{project_id}/{decision_id}/answer",
    response_model=ClarificationDecisionResponse
)
@router.patch(
    "/clarifications/{project_id}/{decision_id}/answer",
    response_model=ClarificationDecisionResponse
)
def answer_clarification(
    decision_id: str,
    payload: AnswerPayload,
    project: Project = Depends(get_project_editor),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Submits an authoritative answer. Nonblank answer is strictly required.
    Marks downstream test cases stale.
    """
    cleaned_answer = payload.answer.strip()
    if not cleaned_answer:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty answer is required to mark this clarification as Answered."
        )

    dec = db.query(ClarificationDecision).filter(
        ClarificationDecision.id == decision_id,
        ClarificationDecision.project_id == project.id
    ).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Clarification item not found.")

    now = datetime.now(timezone.utc)
    prev_status = dec.status
    dec.reviewer_answer = cleaned_answer
    dec.status = "Answered"
    dec.decision = "answered"
    dec.answered_by = current_user.email or current_user.id
    dec.answered_at = now
    dec.updated_at = now

    hist = list(dec.history or [])
    hist.append({
        "action": "answered",
        "user": current_user.email or current_user.id,
        "timestamp": now.isoformat(),
        "previous_status": prev_status,
        "new_status": "Answered",
        "answer": cleaned_answer
    })
    dec.history = hist

    # Invalidate affected tests
    _mark_affected_tests_stale(project.id, dec.requirement_id, db)

    db.commit()
    db.refresh(dec)
    return dec


@router.post(
    "/clarifications/{project_id}/{decision_id}/confirm",
    response_model=ClarificationDecisionResponse
)
@router.patch(
    "/clarifications/{project_id}/{decision_id}/confirm",
    response_model=ClarificationDecisionResponse
)
def confirm_clarification(
    decision_id: str,
    project: Project = Depends(get_project_editor),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Reviewer confirms the answer as authoritative (Resolved status).
    Requires a nonblank answer to be present.
    """
    dec = db.query(ClarificationDecision).filter(
        ClarificationDecision.id == decision_id,
        ClarificationDecision.project_id == project.id
    ).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Clarification item not found.")

    if not dec.reviewer_answer or not dec.reviewer_answer.strip():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot resolve clarification without a recorded answer."
        )

    now = datetime.now(timezone.utc)
    prev_status = dec.status
    dec.status = "Resolved"
    dec.decision = "accepted"
    dec.confirmed_by = current_user.email or current_user.id
    dec.confirmed_at = now
    dec.updated_at = now

    hist = list(dec.history or [])
    hist.append({
        "action": "confirmed",
        "user": current_user.email or current_user.id,
        "timestamp": now.isoformat(),
        "previous_status": prev_status,
        "new_status": "Resolved"
    })
    dec.history = hist

    db.commit()
    db.refresh(dec)
    return dec


@router.post(
    "/clarifications/{project_id}/{decision_id}/dismiss",
    response_model=ClarificationDecisionResponse
)
@router.patch(
    "/clarifications/{project_id}/{decision_id}/dismiss",
    response_model=ClarificationDecisionResponse
)
def dismiss_clarification(
    decision_id: str,
    payload: DismissPayload,
    project: Project = Depends(get_project_editor),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Dismisses clarification item. Mandatory reason is required.
    """
    cleaned_reason = payload.reason.strip()
    if not cleaned_reason:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A non-empty dismissal reason is required."
        )

    dec = db.query(ClarificationDecision).filter(
        ClarificationDecision.id == decision_id,
        ClarificationDecision.project_id == project.id
    ).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Clarification item not found.")

    now = datetime.now(timezone.utc)
    prev_status = dec.status
    dec.status = "Dismissed"
    dec.decision = "rejected"
    dec.dismissal_reason = cleaned_reason
    dec.dismissed_by = current_user.email or current_user.id
    dec.dismissed_at = now
    dec.updated_at = now

    hist = list(dec.history or [])
    hist.append({
        "action": "dismissed",
        "user": current_user.email or current_user.id,
        "timestamp": now.isoformat(),
        "previous_status": prev_status,
        "new_status": "Dismissed",
        "reason": cleaned_reason
    })
    dec.history = hist

    db.commit()
    db.refresh(dec)
    return dec


@router.post(
    "/clarifications/{project_id}/{decision_id}/reopen",
    response_model=ClarificationDecisionResponse
)
@router.patch(
    "/clarifications/{project_id}/{decision_id}/reopen",
    response_model=ClarificationDecisionResponse
)
def reopen_clarification(
    decision_id: str,
    project: Project = Depends(get_project_editor),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Reopens a dismissed or answered clarification back to Open status."""
    dec = db.query(ClarificationDecision).filter(
        ClarificationDecision.id == decision_id,
        ClarificationDecision.project_id == project.id
    ).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Clarification item not found.")

    now = datetime.now(timezone.utc)
    prev_status = dec.status
    dec.status = "Open"
    dec.decision = "pending"
    dec.reopened_by = current_user.email or current_user.id
    dec.reopened_at = now
    dec.updated_at = now

    hist = list(dec.history or [])
    hist.append({
        "action": "reopened",
        "user": current_user.email or current_user.id,
        "timestamp": now.isoformat(),
        "previous_status": prev_status,
        "new_status": "Open"
    })
    dec.history = hist

    db.commit()
    db.refresh(dec)
    return dec


@router.patch(
    "/clarifications/{project_id}/{decision_id}",
    response_model=ClarificationDecisionResponse
)
def update_clarification_decision(
    decision_id: str,
    payload: UpdateDecisionPayload,
    project: Project = Depends(get_project_editor),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generic update endpoint with validation for legacy and inline edits."""
    dec = db.query(ClarificationDecision).filter(
        ClarificationDecision.id == decision_id,
        ClarificationDecision.project_id == project.id,
    ).first()
    if not dec:
        raise HTTPException(status_code=404, detail="Clarification decision not found.")

    now = datetime.now(timezone.utc)
    hist = list(dec.history or [])

    if payload.reviewer_answer is not None:
        dec.reviewer_answer = payload.reviewer_answer.strip()
        if dec.reviewer_answer:
            dec.status = "Answered"
            dec.decision = "answered"
            dec.answered_by = current_user.email or current_user.id
            dec.answered_at = now
            _mark_affected_tests_stale(project.id, dec.requirement_id, db)

    if payload.status:
        if payload.status == "Dismissed" and not (payload.dismissal_reason or dec.dismissal_reason):
            raise HTTPException(
                status_code=422,
                detail="A dismissal reason is required to dismiss a clarification."
            )
        dec.status = payload.status

    if payload.dismissal_reason is not None:
        dec.dismissal_reason = payload.dismissal_reason.strip()

    dec.updated_at = now
    hist.append({
        "action": "updated",
        "user": current_user.email or current_user.id,
        "timestamp": now.isoformat(),
        "status": dec.status
    })
    dec.history = hist

    db.commit()
    db.refresh(dec)
    return dec


@router.delete("/clarifications/{project_id}", status_code=204)
def delete_clarification_decisions(
    project: Project = Depends(get_project_editor),
    db: Session = Depends(get_db)
):
    """Clear all clarification decisions for a project."""
    db.query(ClarificationDecision).filter(
        ClarificationDecision.project_id == project.id
    ).delete(synchronize_session=False)
    db.commit()
