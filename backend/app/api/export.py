import json
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from backend.app.db.session import get_db
from backend.app.models.entities import Project, TestCase, Requirement, Flag, ExportHistory
from backend.app.export.excel_builder import generate_excel_workbook
from backend.app.export.csv_builder import generate_standard_csv, generate_jira_csv

router = APIRouter(tags=["Export"])


@router.get("/export/{project_id}")
def export_test_cases(
    project_id: str,
    format: str = Query("xlsx", pattern="^(xlsx|csv|json|jira)$"),
    role: Optional[str] = None,
    scenario_type: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    requirement_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    query = db.query(TestCase).filter(TestCase.project_id == project_id)
    if role:
        query = query.filter(TestCase.role.ilike(f"%{role}%"))
    if scenario_type:
        query = query.filter(TestCase.scenario_type == scenario_type)
    if priority:
        query = query.filter(TestCase.priority == priority)
    if status:
        query = query.filter(TestCase.status == status)
    if requirement_id:
        query = query.filter(TestCase.requirement_id == requirement_id)

    cases = query.order_by(TestCase.id.asc()).all()
    if not cases:
        raise HTTPException(status_code=400, detail="No test cases found matching the export criteria.")

    reqs = db.query(Requirement).filter(Requirement.project_id == project_id).all()
    req_dicts = [{"id": r.id, "title": r.title, "text": r.text} for r in reqs]

    tc_dicts = []
    for c in cases:
        flags = db.query(Flag).filter(Flag.test_case_id == c.id, Flag.project_id == project_id).all()
        flags_data = [{"type": f.type, "severity": f.severity, "message": f.message, "suggested_question": f.suggested_question} for f in flags]
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
            "status": c.status,
            "flags": flags_data
        })

    # Record export in export_history
    history_entry = ExportHistory(
        project_id=project_id,
        format=format,
        test_case_count=len(tc_dicts)
    )
    db.add(history_entry)
    db.commit()

    safe_title = "".join(c for c in project.name if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")

    if format == "xlsx":
        excel_stream = generate_excel_workbook(tc_dicts, req_dicts, project.name)
        filename = f"{safe_title}_Test_Suite.xlsx"
        return StreamingResponse(
            excel_stream,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    elif format == "csv":
        csv_stream = generate_standard_csv(tc_dicts)
        filename = f"{safe_title}_Test_Cases.csv"
        return Response(
            content=csv_stream.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    elif format == "jira":
        jira_stream = generate_jira_csv(tc_dicts)
        filename = f"{safe_title}_Jira_Import.csv"
        return Response(
            content=jira_stream.getvalue(),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

    elif format == "json":
        export_payload = {
            "project_id": project.id,
            "project_name": project.name,
            "total_cases": len(tc_dicts),
            "requirements": req_dicts,
            "test_cases": tc_dicts
        }
        json_str = json.dumps(export_payload, indent=2)
        filename = f"{safe_title}_Test_Suite.json"
        return Response(
            content=json_str,
            media_type="application/json",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )

# Commit ref: 53
