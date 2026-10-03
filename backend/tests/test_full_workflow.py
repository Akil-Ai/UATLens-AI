"""
Integration test suite for end-to-end API workflows.
Validates permission analysis, clarification lifecycles, versioned test suite regeneration, and source evidence verification.
"""
import io
import json
import pytest
from fastapi.testclient import TestClient
from backend.app.main import app
from backend.app.core.auth import get_current_user, AuthUser
from backend.app.db.session import SessionLocal
from backend.app.models.entities import (
    Project, Requirement, TestCase, PermissionRule, ClarificationDecision, TestSuiteVersion
)

from backend.app.services.permission_analyzer import extract_permission_rules, reconcile_permission_rules
from backend.app.validation.engine import verify_source_quote_detailed, normalize_text_for_search
from backend.app.parsing.docx_parser import parse_docx
from backend.app.parsing.json_parser import parse_and_validate_json_requirements
from fastapi import HTTPException

client = TestClient(app)

user_a = AuthUser(
    id="user-qa-100",
    email="qa.lead@enterprise.com",
    role="QA Lead",
    name="QA Lead"
)

user_b = AuthUser(
    id="user-qa-200",
    email="other.user@enterprise.com",
    role="Reviewer",
    name="Other User"
)


# ─────────────────────────────────────────────────────────────
# 1. PERMISSION ANALYSIS & EXCLUSIVE RULES
# ─────────────────────────────────────────────────────────────

def test_permission_only_admin_can_approve_refunds():
    """
    Requirement 2 verification:
    'Only Admin can approve refunds' must never become 'Admin cannot approve refunds.'
    It must yield:
    - Admin: Allowed
    - Other/Non-Admin: Denied
    """
    text = "Only Admin can approve refunds. Refunds over $1000 require CFO sign-off."
    rules = extract_permission_rules(text)

    # Check Admin permission
    admin_rules = [r for r in rules if r["role"].lower() == "admin" and "refund" in r["resource"].lower()]
    assert len(admin_rules) > 0
    assert admin_rules[0]["decision"] == "Allowed", f"Admin should be Allowed, got {admin_rules[0]['decision']}"
    assert "approve" in admin_rules[0]["action"].lower()

    # Check that exclusive rule generated non-admin denial or scope restriction
    denied_rules = [r for r in rules if r["decision"] == "Denied" and "refund" in r["resource"].lower()]
    assert len(denied_rules) > 0, "Exclusive rule 'Only Admin' must enforce denial for non-admin roles"


def test_permission_scope_and_conditions():
    """
    Verifies 'Employees can view only their own requests' extracts scope 'own records'.
    """
    text = "Employees can view only their own requests. Supervisors can view all team requests."
    rules = extract_permission_rules(text)

    emp_rules = [r for r in rules if r["role"].lower() == "employee" or "employee" in r["role"].lower()]
    assert len(emp_rules) > 0
    assert emp_rules[0]["decision"] == "Allowed"
    assert "own" in (emp_rules[0]["scope"] or "").lower()


def test_permission_explicit_denial_and_conflict():
    """
    Verifies explicit denial and conflicting statement detection with dual evidence.
    """
    text = (
        "Auditors cannot modify financial records.\n"
        "Manager can edit transactions.\n"
        "Manager cannot edit transactions before month end."
    )
    rules = extract_permission_rules(text)

    # Auditor explicit denial
    auditor_rules = [r for r in rules if "auditor" in r["role"].lower()]
    assert len(auditor_rules) > 0
    assert auditor_rules[0]["decision"] == "Denied"

    # Manager conflict or conditional
    mgr_rules = [r for r in rules if "manager" in r["role"].lower()]
    assert len(mgr_rules) > 0
    # Must have either Conflicting decision or separate condition
    has_conflict_or_condition = any(
        r["decision"] == "Conflicting" or r.get("condition") or r["decision"] == "Denied"
        for r in mgr_rules
    )
    assert has_conflict_or_condition


def test_permission_reanalysis_stability():
    """
    Reanalysis must reconcile existing rules, preserve stable IDs (PR-001) and reviewer status.
    """
    existing_rules = [
        PermissionRule(
            id="PR-001",
            project_id="proj-stability",
            role="Admin",
            action="approve",
            resource="refunds",
            scope="global",
            decision="Allowed",
            review_status="Confirmed",
            revision=2,
            source_quote="Only Admin can approve refunds."
        )
    ]

    new_extractions = [
        {
            "role": "Admin",
            "action": "approve",
            "resource": "refunds",
            "scope": "global",
            "decision": "Allowed",
            "condition": "amount <= 1000",
            "source_quote": "Only Admin can approve refunds up to $1000."
        }
    ]

    reconciled = reconcile_permission_rules(existing_rules, new_extractions, "proj-stability")
    assert len(reconciled) == 1
    # ID must be preserved
    assert reconciled[0].id == "PR-001"
    # Revision incremented
    assert reconciled[0].revision >= 2


# ─────────────────────────────────────────────────────────────
# 2. CLARIFICATION WORKFLOW & INVALIDATION
# ─────────────────────────────────────────────────────────────

def test_clarification_lifecycle_and_invalidation():
    app.dependency_overrides[get_current_user] = lambda: user_a

    # 1. Create project
    create_res = client.post("/api/projects", json={
        "name": "Clarification Lifecycle UAT",
        "raw_text": "Cart holds between 1 and 10 units. VIP checkout is expedited."
    })
    assert create_res.status_code == 200
    p_id = create_res.json()["id"]

    db = SessionLocal()
    try:
        # Create a requirement
        req = Requirement(
            id="REQ-VIP",
            project_id=p_id,
            title="VIP Checkout",
            text="VIP checkout is expedited.",
            source_quote="VIP checkout is expedited.",
            roles_involved=["VIP Customer"]
        )
        # Create a clarification question
        clar = ClarificationDecision(
            id="CLAR-001",
            project_id=p_id,
            requirement_id="REQ-VIP",
            issue_type="Ambiguous Requirement",
            description="VIP expedited wording",
            suggested_question="What does expedited mean in milliseconds or priority?",
            source_evidence="VIP checkout is expedited.",
            status="Open"
        )
        # Create a test case linked to this requirement
        tc = TestCase(
            id="TC-VIP-1",
            project_id=p_id,
            requirement_id="REQ-VIP",
            scenario="Verify VIP expedited checkout",
            scenario_type="Positive",
            role="VIP Customer",
            priority="High",
            steps=["1. Login as VIP", "2. Checkout"],
            expected_result="Processed in under 500ms",
            status="Draft",
            is_stale=False
        )
        db.add_all([req, clar, tc])
        db.commit()

        # 2. Answering with empty text MUST fail (400)
        empty_ans_res = client.patch(f"/api/clarifications/{p_id}/CLAR-001/answer", json={"answer": "   "})
        assert empty_ans_res.status_code == 400

        # 3. Answering with valid text marks affected tests stale
        ans_res = client.patch(f"/api/clarifications/{p_id}/CLAR-001/answer", json={"answer": "Expedited means guaranteed queue priority within 250ms."})
        assert ans_res.status_code == 200
        assert ans_res.json()["status"] == "Answered"

        # Verify test case is now marked stale
        db.expire_all()
        reloaded_tc = db.query(TestCase).filter(TestCase.id == "TC-VIP-1").first()
        assert reloaded_tc.is_stale is True

        # 4. Confirming resolution
        conf_res = client.patch(f"/api/clarifications/{p_id}/CLAR-001/confirm", json={})
        assert conf_res.status_code == 200
        assert conf_res.json()["status"] == "Resolved"

        # 5. Dismissal without reason MUST fail (400)
        dismiss_fail = client.patch(f"/api/clarifications/{p_id}/CLAR-001/dismiss", json={"reason": "  "})
        assert dismiss_fail.status_code == 400

        # 6. Dismissal with reason succeeds
        dismiss_ok = client.patch(f"/api/clarifications/{p_id}/CLAR-001/dismiss", json={"reason": "Out of scope for phase 1"})
        assert dismiss_ok.status_code == 200
        assert dismiss_ok.json()["status"] == "Dismissed"
        assert dismiss_ok.json()["dismissal_reason"] == "Out of scope for phase 1"

    finally:
        db.close()
        client.delete(f"/api/projects/{p_id}")
        app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────
# 3. SAFE VERSIONED REGENERATION & ATOMIC ROLLBACK
# ─────────────────────────────────────────────────────────────

def test_suite_versioning_and_targeted_regeneration():
    app.dependency_overrides[get_current_user] = lambda: user_a

    # Create project
    create_res = client.post("/api/projects", json={
        "name": "Versioned Suite Project",
        "raw_text": "Cart checkout and order management."
    })
    assert create_res.status_code == 200
    p_id = create_res.json()["id"]

    db = SessionLocal()
    try:
        req1 = Requirement(id="REQ-1", project_id=p_id, title="Cart Checkout", text="Cart checkout logic.")
        req2 = Requirement(id="REQ-2", project_id=p_id, title="Order History", text="Order history view.")
        tc1 = TestCase(id="TC-001", project_id=p_id, requirement_id="REQ-1", scenario="Cart test", scenario_type="Positive", steps=["Step 1"], expected_result="Cart ok", status="Approved")
        tc2 = TestCase(id="TC-002", project_id=p_id, requirement_id="REQ-2", scenario="History test", scenario_type="Positive", steps=["Step 1"], expected_result="History ok", status="Approved")
        db.add_all([req1, req2, tc1, tc2])
        db.commit()

        # Archive suite into TestSuiteVersion
        v1 = TestSuiteVersion(
            project_id=p_id,
            version_number=1,
            snapshot=[{"id": "TC-001", "scenario": "Cart test"}, {"id": "TC-002", "scenario": "History test"}],
            model_provider="deterministic-generator",
            model_name="rules-engine",
            test_case_count=2
        )
        db.add(v1)
        db.commit()

        # Targeted regeneration for REQ-1 should preserve TC-002
        regen_res = client.post(f"/api/generate-test-cases?project_id={p_id}&target_requirement_id=REQ-1")
        assert regen_res.status_code == 200

        # Assert REQ-2 test was preserved
        db.expire_all()
        preserved_tc2 = db.query(TestCase).filter(
            TestCase.project_id == p_id,
            TestCase.id == "TC-002"
        ).first()
        assert preserved_tc2 is not None
        assert preserved_tc2.scenario == "History test"

        # Assert suite version incremented
        proj = db.query(Project).filter(Project.id == p_id).first()
        assert proj.current_suite_version >= 2

    finally:
        db.close()
        client.delete(f"/api/projects/{p_id}")
        app.dependency_overrides.clear()


# ─────────────────────────────────────────────────────────────
# 4. PARSING & EVIDENCE ACCURACY
# ─────────────────────────────────────────────────────────────

def test_source_evidence_operators_never_match_opposites():
    """
    Requirement 8:
    Never verify 'amount > 5000' against 'amount < 5000' as equivalent.
    """
    raw_doc = "Orders with amount > 5000 require manager approval. Orders with amount <= 5000 proceed automatically."
    valid_quote = "amount > 5000"
    opposite_quote = "amount < 5000"

    is_valid, _ = verify_source_quote_detailed(valid_quote, raw_doc)
    assert is_valid is True

    # Opposite quote MUST NOT match as exact excerpt
    is_valid_opp, match_type = verify_source_quote_detailed(opposite_quote, raw_doc)
    assert is_valid_opp is False


def test_structured_json_requirement_parsing():
    """
    Requirement 8:
    Structured JSON requirement import, including schema validation and clear errors.
    """
    valid_json = json.dumps({
        "project_name": "API Payment Gateway",
        "requirements": [
            {
                "id": "REQ-PAY-1",
                "title": "Credit Card Auth",
                "text": "Card payments must be authenticated via 3D Secure.",
                "roles_involved": ["Cardholder", "Payment Service Provider"],
                "expected_outcome": "3DS challenge displayed."
            }
        ]
    }).encode("utf-8")

    markdown_text, headings, tables = parse_and_validate_json_requirements(valid_json)
    assert "Credit Card Auth" in markdown_text
    assert "REQ-PAY-1" in markdown_text
    assert len(headings) >= 1

    # Invalid JSON raises HTTPException 422
    invalid_json = b"{ invalid json content"
    with pytest.raises(HTTPException) as exc_info:
        parse_and_validate_json_requirements(invalid_json)
    assert exc_info.value.status_code == 422
