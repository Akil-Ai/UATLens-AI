from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.entities import Project, TestCase, Requirement, Flag
from backend.app.validation.engine import validate_test_suite
from backend.app.schemas.validation import SuiteValidationReport

router = APIRouter(tags=["Validation"])


@router.post("/validate-suite", response_model=SuiteValidationReport)
def validate_suite(project_id: str = Query(...), db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    cases = db.query(TestCase).filter(TestCase.project_id == project_id).order_by(TestCase.id.asc()).all()
    reqs = db.query(Requirement).filter(Requirement.project_id == project_id).all()

    tc_dicts = [
        {
            "id": c.id,
            "requirement_id": c.requirement_id,
            "scenario": c.scenario,
            "scenario_type": c.scenario_type,
            "role": c.role,
            "priority": c.priority,
            "preconditions": c.preconditions or [],
            "steps": c.steps or [],
            "test_data": c.test_data or {},
            "expected_result": c.expected_result,
            "source_quote": c.source_quote,
            "status": c.status,
            "flags": []
        }
        for c in cases
    ]
    req_dicts = [{"id": r.id, "title": r.title, "text": r.text} for r in reqs]

    report = validate_test_suite(tc_dicts, req_dicts, project.raw_text)

    # Sync flags table
    db.query(Flag).filter(Flag.project_id == project_id).delete(synchronize_session=False)

    for item in report.get("clarification_items", []):
        db.add(Flag(
            test_case_id=item.get("test_case_id"),
            project_id=project_id,
            requirement_id=item.get("requirement_id"),
            type=item.get("type", "General"),
            severity=item.get("severity", "Medium"),
            message=item.get("message", ""),
            suggested_question=item.get("suggested_question")
        ))
    db.commit()

    return SuiteValidationReport(
        project_id=project_id,
        total_test_cases=report["total_test_cases"],
        open_flags_count=report["open_flags_count"],
        quality_score=report["quality_score"],
        flags_by_type=report["flags_by_type"],
        coverage_gaps=report["coverage_gaps"],
        clarification_items=report["clarification_items"]
    )
