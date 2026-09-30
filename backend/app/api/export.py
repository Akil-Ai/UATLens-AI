import json
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any

from backend.app.db.session import get_db
from backend.app.models.entities import Project, TestCase, Requirement, Flag, ClarificationDecision, PermissionRule, ExportHistory
from backend.app.export.excel_builder import generate_excel_workbook
from backend.app.export.csv_builder import (
    generate_standard_csv,
    generate_jira_csv,
    generate_zip_bundle,
)
from backend.app.core.auth import AuthUser, get_current_user
from backend.app.core.project_access import get_project_viewer

router = APIRouter(tags=["Export"])


@router.get("/export/{project_id}")
def export_test_cases(
    project_id: str,
    format: str = Query("xlsx", pattern="^(xlsx|csv|json|jira|zip)$"),
    role: Optional[str] = None,
    scenario_type: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    requirement_id: Optional[str] = None,
    project: Project = Depends(get_project_viewer),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Exports comprehensive test suites and traceability records.
    Supported formats:
    - xlsx: Multi-sheet Excel workbook (Test Cases, Requirements, Clarifications, Permission Rules, Coverage Summary)
    - csv: Traceable CSV with formula-injection protection
    - jira: Jira/TestRail import format
    - json: Structured versioned JSON payload
    - zip: Multi-table CSV bundle (Test Cases, Requirements, Clarifications, Permission Rules)
    Record export success only after the export is built.
    """
    # 1. Query test cases matching filters
    query = db.query(TestCase).filter(TestCase.project_id == project.id)
    has_filters = False
    if role:
        query = query.filter(TestCase.role.ilike(f"%{role}%"))
        has_filters = True
    if scenario_type:
        query = query.filter(TestCase.scenario_type == scenario_type)
        has_filters = True
    if priority:
        query = query.filter(TestCase.priority == priority)
        has_filters = True
    if status:
        query = query.filter(TestCase.status == status)
        has_filters = True
    if requirement_id:
        query = query.filter(TestCase.requirement_id == requirement_id)
        has_filters = True

    cases = query.order_by(TestCase.id.asc()).all()
    if not cases:
        raise HTTPException(status_code=400, detail="No test cases found matching the export criteria.")

    # 2. Query supporting entities
    reqs = db.query(Requirement).filter(Requirement.project_id == project.id).all()
    req_dicts = [
        {
            "id": r.id,
            "title": r.title,
            "text": r.text,
            "source_quote": r.source_quote or "",
            "roles_involved": r.roles_involved or [],
            "expected_outcome": r.expected_outcome or "",
        }
        for r in reqs
    ]

    clarifications = db.query(ClarificationDecision).filter(ClarificationDecision.project_id == project.id).all()
    clar_dicts = [
        {
            "id": c.id,
            "requirement_id": c.requirement_id,
            "issue_type": c.issue_type,
            "suggested_question": c.suggested_question,
            "status": c.status,
            "reviewer_answer": c.reviewer_answer or "",
            "confirmed_by": c.confirmed_by or "",
            "dismissal_reason": c.dismissal_reason or "",
        }
        for c in clarifications
    ]

    perm_rules = db.query(PermissionRule).filter(
        PermissionRule.project_id == project.id,
        PermissionRule.is_active == True
    ).all()
    perm_dicts = [
        {
            "id": p.id,
            "role": p.role,
            "action": p.action,
            "resource": p.resource or "",
            "scope": p.scope or "unspecified",
            "condition": p.condition or "",
            "decision": p.decision,
            "review_status": p.review_status,
            "revision": p.revision,
        }
        for p in perm_rules
    ]

    tc_dicts = []
    tested_req_ids = set()
    tested_rule_ids = set()

    for c in cases:
        flags = db.query(Flag).filter(Flag.test_case_id == c.id, Flag.project_id == project.id).all()
        flags_data = [
            {"type": f.type, "severity": f.severity, "message": f.message, "suggested_question": f.suggested_question}
            for f in flags
        ]
        if c.requirement_id:
            tested_req_ids.add(c.requirement_id)
        if c.permission_rule_ids:
            tested_rule_ids.update(c.permission_rule_ids)

        tc_dicts.append({
            "id": c.id,
            "scenario": c.scenario,
            "scenario_type": c.scenario_type,
            "role": c.role,
            "priority": c.priority,
            "preconditions": c.preconditions or [],
            "steps": c.steps or [],
            "test_data": c.test_data or {},
            "expected_result": c.expected_result,
            "source_quote": c.source_quote or "",
            "requirement_id": c.requirement_id,
            "permission_rule_ids": c.permission_rule_ids or [],
            "status": c.status,
            "is_stale": c.is_stale or False,
            "is_blocked": c.is_blocked or False,
            "blocked_reason": c.blocked_reason or "",
            "flags": flags_data
        })

    coverage_summary = {
        "scope": "Filtered Selection" if has_filters else "Full Project",
        "tested_requirements": len(tested_req_ids),
        "total_requirements": len(reqs),
        "tested_permissions": len(tested_rule_ids),
        "total_permission_rules": len(perm_rules),
    }

    safe_title = "".join(c for c in project.name if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")

    # 3. Build export stream based on format
    if format == "xlsx":
        excel_stream = generate_excel_workbook(
            tc_dicts,
            req_dicts,
            project.name,
            clar_dicts,
            perm_dicts,
            coverage_summary,
        )
        response = StreamingResponse(
            excel_stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}_Test_Suite.xlsx"'}
        )

    elif format == "csv":
        csv_stream = generate_standard_csv(tc_dicts)
        response = Response(
            content="\ufeff" + csv_stream.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}_Test_Cases.csv"'}
        )

    elif format == "zip":
        zip_stream = generate_zip_bundle(tc_dicts, req_dicts, clar_dicts, perm_dicts)
        response = StreamingResponse(
            zip_stream,
            media_type="application/zip",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}_UAT_Bundle.zip"'}
        )

    elif format == "jira":
        jira_stream = generate_jira_csv(tc_dicts)
        response = Response(
            content="\ufeff" + jira_stream.getvalue(),
            media_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}_Jira_Import.csv"'}
        )

    elif format == "json":
        export_payload = {
            "schema_version": "2.0.0",
            "project_id": project.id,
            "project_name": project.name,
            "coverage_scope": coverage_summary["scope"],
            "coverage_summary": coverage_summary,
            "total_test_cases": len(tc_dicts),
            "requirements": req_dicts,
            "test_cases": tc_dicts,
            "clarifications": clar_dicts,
            "permission_rules": perm_dicts,
        }
        json_str = json.dumps(export_payload, indent=2, ensure_ascii=False)
        response = Response(
            content=json_str,
            media_type="application/json; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{safe_title}_Test_Suite.json"'}
        )

    # 4. Record export success ONLY after export is built successfully
    try:
        history_entry = ExportHistory(
            project_id=project.id,
            format=format,
            test_case_count=len(tc_dicts)
        )
        db.add(history_entry)
        db.commit()
    except Exception:
        db.rollback()

    return response
