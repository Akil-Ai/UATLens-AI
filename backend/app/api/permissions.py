"""
API endpoints for Role & Permission Analysis and Coverage.

Endpoints:
- POST /api/permissions/{project_id}/extract  — (re-)extract & reconcile permission rules
- GET  /api/permissions/{project_id}          — list all active/superseded rules
- PATCH /api/permissions/{project_id}/{rule_id} — review/confirm/correct rule
- DELETE /api/permissions/{project_id}        — reset rules
- GET  /api/permissions/{project_id}/coverage — accurate permission coverage based on exact rule ID linking
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, ConfigDict
import uuid

from backend.app.db.session import get_db
from backend.app.models.entities import Project, ExtractedContext, PermissionRule, TestCase
from backend.app.core.auth import AuthUser, get_current_user
from backend.app.core.project_access import get_project_viewer, get_project_editor
from backend.app.services.permission_analyzer import (
    analyze_permissions_from_context,
    reconcile_permission_rules,
)

router = APIRouter(tags=["Permissions"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class PermissionRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    project_id: str
    role: str
    action: str
    resource: Optional[str] = "General"
    scope: Optional[str] = "unspecified"
    condition: Optional[str] = None
    workflow_state: Optional[str] = None
    decision: str                      # Allowed | Denied | Unspecified | Conflicting
    source_quote: Optional[str] = ""
    source_location: Optional[str] = None
    source_requirement_id: Optional[str] = None
    source_rule_id: Optional[str] = None
    review_status: str                 # Draft | Confirmed | Corrected | Superseded
    reviewer_notes: Optional[str] = None
    revision: int = 1
    is_active: bool = True
    evidence: Optional[Dict[str, Any]] = None


class PermissionRuleUpdate(BaseModel):
    role: Optional[str] = None
    action: Optional[str] = None
    resource: Optional[str] = None
    scope: Optional[str] = None
    condition: Optional[str] = None
    workflow_state: Optional[str] = None
    decision: Optional[str] = None     # Allowed | Denied | Unspecified | Conflicting
    review_status: Optional[str] = None # Confirmed | Corrected
    reviewer_notes: Optional[str] = None


class PermissionCoverageMetric(BaseModel):
    role: str
    total_permissions: int
    allow_count: int
    deny_count: int
    tested_allow: int        # positive test cases explicitly linked to Allowed rules
    tested_deny: int         # negative test cases explicitly linked to Denied rules
    approved_tested_allow: int
    approved_tested_deny: int
    blocked_or_stale_count: int
    coverage_pct: Optional[float] # None if denominator is 0 (N/A)


class PermissionCoverageResponse(BaseModel):
    metrics: List[PermissionCoverageMetric]
    total_active_rules: int
    uncovered_rules: List[Dict[str, Any]]
    is_empty_denominator: bool


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/permissions/{project_id}/extract", response_model=List[PermissionRuleResponse])
def extract_permission_rules(
    project: Project = Depends(get_project_editor),
    db: Session = Depends(get_db)
):
    """
    Analyzes project context and extracts/reconciles permission rules.
    Preserves stable IDs, reviewer corrections, and tracks superseded rules.
    """
    project_id = project.id
    ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project_id).first()
    if not ctx:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Context has not been extracted yet. Please run Stage 2 Context Extraction first."
        )

    existing_rules = (
        db.query(PermissionRule)
        .filter(PermissionRule.project_id == project_id)
        .all()
    )

    new_raw_rules = analyze_permissions_from_context(ctx, project_id, project.raw_text)
    reconciled = reconcile_permission_rules(existing_rules, new_raw_rules, project_id)

    for rule in reconciled:
        db.add(rule)

    db.commit()
    for rule in reconciled:
        db.refresh(rule)

    return [r for r in reconciled if r.is_active]


@router.get("/permissions/{project_id}", response_model=List[PermissionRuleResponse])
def list_permission_rules(
    include_superseded: bool = False,
    project: Project = Depends(get_project_viewer),
    db: Session = Depends(get_db)
):
    """Return all permission rules for the project."""
    query = db.query(PermissionRule).filter(PermissionRule.project_id == project.id)
    if not include_superseded:
        query = query.filter(PermissionRule.is_active == True)
    rules = query.order_by(PermissionRule.role.asc(), PermissionRule.id.asc()).all()
    return rules


@router.patch("/permissions/{project_id}/{rule_id}", response_model=PermissionRuleResponse)
def update_permission_rule(
    rule_id: str,
    payload: PermissionRuleUpdate,
    project: Project = Depends(get_project_editor),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Review, confirm, or correct an extracted permission rule."""
    rule = (
        db.query(PermissionRule)
        .filter(PermissionRule.project_id == project.id, PermissionRule.id == rule_id)
        .first()
    )
    if not rule:
        raise HTTPException(status_code=404, detail=f"Permission rule '{rule_id}' not found.")

    is_modified = False
    if payload.role and payload.role != rule.role:
        rule.role = payload.role
        is_modified = True
    if payload.action and payload.action != rule.action:
        rule.action = payload.action
        is_modified = True
    if payload.resource is not None:
        rule.resource = payload.resource
        is_modified = True
    if payload.scope is not None:
        rule.scope = payload.scope
        is_modified = True
    if payload.condition is not None:
        rule.condition = payload.condition
        is_modified = True
    if payload.workflow_state is not None:
        rule.workflow_state = payload.workflow_state
        is_modified = True
    if payload.decision and payload.decision != rule.decision:
        rule.decision = payload.decision
        is_modified = True
    if payload.reviewer_notes is not None:
        rule.reviewer_notes = payload.reviewer_notes

    if payload.review_status:
        rule.review_status = payload.review_status
    elif is_modified:
        rule.review_status = "Corrected"
        rule.revision += 1

    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/permissions/{project_id}", status_code=204)
def clear_permission_rules(
    project: Project = Depends(get_project_editor),
    db: Session = Depends(get_db)
):
    """Clear all permission rules for the project."""
    db.query(PermissionRule).filter(PermissionRule.project_id == project.id).delete(
        synchronize_session=False
    )
    db.commit()


@router.get("/permissions/{project_id}/coverage", response_model=PermissionCoverageResponse)
def get_permission_coverage(
    project: Project = Depends(get_project_viewer),
    db: Session = Depends(get_db)
):
    """
    Computes per-role permission test coverage using exact rule IDs.
    - All active rules are included
    - Positive tests verify Allowed rules; Negative tests verify Denied rules
    - Boundary tests do NOT count as Denied tests
    - Empty denominators return N/A (None)
    """
    project_id = project.id
    rules = (
        db.query(PermissionRule)
        .filter(PermissionRule.project_id == project_id, PermissionRule.is_active == True)
        .all()
    )
    test_cases = (
        db.query(TestCase)
        .filter(TestCase.project_id == project_id)
        .all()
    )

    if not rules:
        return PermissionCoverageResponse(
            metrics=[],
            total_active_rules=0,
            uncovered_rules=[],
            is_empty_denominator=True
        )

    # Build traceability index: rule_id -> list of test cases
    # Supports both explicit permission_rule_ids JSON array and role+action mapping
    rule_tc_map: Dict[str, List[TestCase]] = {}
    for tc in test_cases:
        linked_rule_ids = tc.permission_rule_ids or []
        for rid in linked_rule_ids:
            rule_tc_map.setdefault(rid, []).append(tc)

    # Group rules by role
    by_role: Dict[str, List[PermissionRule]] = {}
    for r in rules:
        by_role.setdefault(r.role, []).append(r)

    metrics: List[PermissionCoverageMetric] = []
    uncovered_rules: List[Dict[str, Any]] = []

    for role, role_rules in sorted(by_role.items()):
        allow_rules = [r for r in role_rules if r.decision == "Allowed"]
        deny_rules = [r for r in role_rules if r.decision == "Denied"]

        tested_allow = 0
        approved_allow = 0
        tested_deny = 0
        approved_deny = 0
        blocked_or_stale = 0

        # Allowed rules check
        for ar in allow_rules:
            linked_tcs = rule_tc_map.get(ar.id, [])
            # Fallback check if test cases match role and action keywords
            if not linked_tcs:
                action_kws = set(ar.action.lower().split()[:3])
                linked_tcs = [
                    tc for tc in test_cases
                    if tc.role.lower() == role.lower() and
                    tc.scenario_type == "Positive" and
                    any(kw in tc.scenario.lower() or kw in tc.expected_result.lower() for kw in action_kws)
                ]

            pos_tests = [tc for tc in linked_tcs if tc.scenario_type == "Positive"]
            if pos_tests:
                tested_allow += 1
                if any(tc.status in ("Approved", "Reviewed") for tc in pos_tests):
                    approved_allow += 1
                if any(tc.is_blocked or tc.is_stale for tc in pos_tests):
                    blocked_or_stale += 1
            else:
                uncovered_rules.append({
                    "rule_id": ar.id,
                    "role": role,
                    "action": ar.action,
                    "decision": "Allowed",
                    "reason": "Missing Positive test case verifying allowed action"
                })

        # Denied rules check
        for dr in deny_rules:
            linked_tcs = rule_tc_map.get(dr.id, [])
            if not linked_tcs:
                action_kws = set(dr.action.lower().split()[:3])
                # STRICT REQUIREMENT: Boundary tests DO NOT count as Denied tests!
                linked_tcs = [
                    tc for tc in test_cases
                    if (tc.role.lower() == role.lower() or "admin" in tc.scenario.lower()) and
                    tc.scenario_type == "Negative" and
                    any(kw in tc.scenario.lower() or kw in tc.expected_result.lower() for kw in action_kws)
                ]

            neg_tests = [tc for tc in linked_tcs if tc.scenario_type == "Negative"]
            if neg_tests:
                tested_deny += 1
                if any(tc.status in ("Approved", "Reviewed") for tc in neg_tests):
                    approved_deny += 1
                if any(tc.is_blocked or tc.is_stale for tc in neg_tests):
                    blocked_or_stale += 1
            else:
                uncovered_rules.append({
                    "rule_id": dr.id,
                    "role": role,
                    "action": dr.action,
                    "decision": "Denied",
                    "reason": "Missing Negative test case verifying rejection/denial"
                })

        total = len(allow_rules) + len(deny_rules)
        tested_total = tested_allow + tested_deny
        coverage_pct = round((tested_total / total * 100), 1) if total > 0 else None

        metrics.append(PermissionCoverageMetric(
            role=role,
            total_permissions=total,
            allow_count=len(allow_rules),
            deny_count=len(deny_rules),
            tested_allow=tested_allow,
            tested_deny=tested_deny,
            approved_tested_allow=approved_allow,
            approved_tested_deny=approved_deny,
            blocked_or_stale_count=blocked_or_stale,
            coverage_pct=coverage_pct
        ))

    return PermissionCoverageResponse(
        metrics=metrics,
        total_active_rules=len(rules),
        uncovered_rules=uncovered_rules,
        is_empty_denominator=False
    )
