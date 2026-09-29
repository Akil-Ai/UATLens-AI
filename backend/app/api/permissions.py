"""
API endpoints for Role & Permission Analysis.

POST /api/permissions/{project_id}/extract  — extract permission rules from context
GET  /api/permissions/{project_id}          — list all permission rules
DELETE /api/permissions/{project_id}        — clear and re-extract
GET  /api/permissions/{project_id}/coverage — permission coverage metrics
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from pydantic import BaseModel
import uuid

from backend.app.db.session import get_db
from backend.app.models.entities import Project, ExtractedContext, PermissionRule, TestCase

router = APIRouter(tags=["Permissions"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class PermissionRuleResponse(BaseModel):
    id: str
    project_id: str
    role: str
    action: str
    condition: Optional[str] = None
    decision: str       # allow | deny
    source_requirement_id: Optional[str] = None
    source_rule_id: Optional[str] = None

    class Config:
        from_attributes = True


class PermissionCoverageMetric(BaseModel):
    role: str
    total_permissions: int
    allow_count: int
    deny_count: int
    tested_allow: int   # how many allow permissions have at least one Positive TC
    tested_deny: int    # how many deny permissions have at least one Negative TC
    coverage_pct: float


class PermissionCoverageResponse(BaseModel):
    metrics: List[PermissionCoverageMetric]
    uncovered_allow: List[Dict[str, str]]  # list of {role, action} not covered positively
    uncovered_deny: List[Dict[str, str]]   # list of {role, action} not covered negatively


# ── Helper: derive permission rules from context ──────────────────────────────

def _derive_permission_rules(ctx: ExtractedContext, project_id: str) -> List[Dict[str, Any]]:
    """
    Build permission rules from extracted context without an extra LLM call.
    Sources:
    1. Each action in ctx.actions → allow rule (role can perform action)
    2. Each role.permissions list → allow rules
    3. Infer deny rules from business rules containing denial language
    """
    rules = []

    # From actions list
    for action_item in (ctx.actions or []):
        role = action_item.get("role", "").strip()
        action = action_item.get("action", "").strip()
        req_id = action_item.get("requirement_id")
        if role and action:
            rules.append({
                "project_id": project_id,
                "role": role,
                "action": action,
                "condition": None,
                "decision": "allow",
                "source_requirement_id": req_id,
                "source_rule_id": None,
            })

    # From role.permissions
    seen_actions = {(r["role"], r["action"]) for r in rules}
    for role_item in (ctx.roles or []):
        role = role_item.get("name", "").strip()
        for perm in role_item.get("permissions", []):
            if (role, perm) not in seen_actions:
                rules.append({
                    "project_id": project_id,
                    "role": role,
                    "action": perm,
                    "condition": None,
                    "decision": "allow",
                    "source_requirement_id": None,
                    "source_rule_id": None,
                })
                seen_actions.add((role, perm))

    # Derive deny rules from business rules containing restriction language
    deny_keywords = ["cannot", "not allowed", "forbidden", "must not", "prohibited",
                     "only admin", "only an admin", "not approve", "cannot approve"]
    for br in (ctx.business_rules or []):
        br_text = br.get("text", "").lower()
        br_id = br.get("id")
        for keyword in deny_keywords:
            if keyword in br_text:
                # Extract a deny hint: parse role from text (simple heuristic)
                text = br.get("text", "")
                for role_item in (ctx.roles or []):
                    role = role_item.get("name", "")
                    if role.lower() in br_text and keyword in br_text:
                        # Infer denied action from sentence around keyword
                        action_hint = f"(restricted) {br.get('text', '')[:120]}"
                        key = (role, action_hint[:80])
                        if key not in seen_actions:
                            rules.append({
                                "project_id": project_id,
                                "role": role,
                                "action": action_hint,
                                "condition": f"Restriction per {br_id}",
                                "decision": "deny",
                                "source_requirement_id": None,
                                "source_rule_id": br_id,
                            })
                            seen_actions.add(key)
                break  # one deny rule per business rule is enough

    return rules


# ── Routes ────────────────────────────────────────────────────────────────────

@router.post("/permissions/{project_id}/extract", response_model=List[PermissionRuleResponse])
def extract_permission_rules(project_id: str, db: Session = Depends(get_db)):
    """
    (Re-)derive permission rules from the project's extracted context.
    Clears existing rules and re-builds from current context.
    """
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project_id).first()
    if not ctx:
        raise HTTPException(
            status_code=400,
            detail="Context has not been extracted yet. Run Stage 2 first."
        )

    # Clear old rules
    db.query(PermissionRule).filter(PermissionRule.project_id == project_id).delete(
        synchronize_session=False
    )

    raw_rules = _derive_permission_rules(ctx, project_id)
    saved = []
    for r in raw_rules:
        row = PermissionRule(
            id=str(uuid.uuid4()),
            **r
        )
        db.add(row)
        saved.append(row)

    db.commit()
    for row in saved:
        db.refresh(row)

    return saved


@router.get("/permissions/{project_id}", response_model=List[PermissionRuleResponse])
def list_permission_rules(project_id: str, db: Session = Depends(get_db)):
    """Return all permission rules for a project."""
    rules = (
        db.query(PermissionRule)
        .filter(PermissionRule.project_id == project_id)
        .order_by(PermissionRule.role.asc(), PermissionRule.decision.asc())
        .all()
    )
    return rules


@router.delete("/permissions/{project_id}", status_code=204)
def clear_permission_rules(project_id: str, db: Session = Depends(get_db)):
    """Clear all permission rules for a project."""
    db.query(PermissionRule).filter(PermissionRule.project_id == project_id).delete(
        synchronize_session=False
    )
    db.commit()


@router.get("/permissions/{project_id}/coverage", response_model=PermissionCoverageResponse)
def get_permission_coverage(project_id: str, db: Session = Depends(get_db)):
    """
    Compute per-role permission test coverage.
    Compares existing permission rules against generated test cases.
    """
    rules = (
        db.query(PermissionRule)
        .filter(PermissionRule.project_id == project_id)
        .all()
    )
    test_cases = (
        db.query(TestCase)
        .filter(TestCase.project_id == project_id)
        .all()
    )

    # Build sets of (role, scenario_type) combinations from test cases
    # allow permissions → need Positive tests; deny → need Negative tests
    tested_roles_pos: Dict[str, set] = {}   # role → set of scenario snippets
    tested_roles_neg: Dict[str, set] = {}

    for tc in test_cases:
        role = tc.role
        snippet = tc.scenario.lower()[:80]
        if tc.scenario_type == "Positive":
            tested_roles_pos.setdefault(role, set()).add(snippet)
        elif tc.scenario_type in ("Negative", "Boundary"):
            tested_roles_neg.setdefault(role, set()).add(snippet)

    # Group rules by role
    by_role: Dict[str, List[PermissionRule]] = {}
    for rule in rules:
        by_role.setdefault(rule.role, []).append(rule)

    metrics = []
    uncovered_allow = []
    uncovered_deny = []

    for role, role_rules in sorted(by_role.items()):
        allow_rules = [r for r in role_rules if r.decision == "allow"]
        deny_rules = [r for r in role_rules if r.decision == "deny"]

        # For coverage: a permission is "tested" if ANY test case for that role
        # references keywords from the action in its scenario text
        tested_allow = 0
        for ar in allow_rules:
            action_kws = set(ar.action.lower().split()[:4])  # first 4 words
            pos_snippets = tested_roles_pos.get(role, set())
            if any(any(kw in snip for kw in action_kws) for snip in pos_snippets):
                tested_allow += 1
            else:
                uncovered_allow.append({"role": role, "action": ar.action})

        tested_deny = 0
        for dr in deny_rules:
            action_kws = set(dr.action.lower().split()[:4])
            neg_snippets = tested_roles_neg.get(role, set())
            if any(any(kw in snip for kw in action_kws) for snip in neg_snippets):
                tested_deny += 1
            else:
                uncovered_deny.append({"role": role, "action": dr.action})

        total = len(allow_rules) + len(deny_rules)
        tested_total = tested_allow + tested_deny
        coverage_pct = round((tested_total / total * 100) if total > 0 else 100.0, 1)

        metrics.append(PermissionCoverageMetric(
            role=role,
            total_permissions=total,
            allow_count=len(allow_rules),
            deny_count=len(deny_rules),
            tested_allow=tested_allow,
            tested_deny=tested_deny,
            coverage_pct=coverage_pct,
        ))

    return PermissionCoverageResponse(
        metrics=metrics,
        uncovered_allow=uncovered_allow,
        uncovered_deny=uncovered_deny,
    )
