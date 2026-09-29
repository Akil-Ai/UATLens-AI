import json
import asyncio
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional, Dict, Any
from backend.app.db.session import get_db, SessionLocal
from backend.app.models.entities import (
    Project,
    Requirement,
    ExtractedContext,
    TestCase,
    TestCaseVersion,
    Flag,
)
from backend.app.schemas.test_case import (
    TestCaseResponse,
    TestCaseUpdate,
    RegenerateFieldRequest,
    BulkUpdateTestCasesRequest,
)
from backend.app.ai.llm_client import llm_client
from backend.app.validation.engine import validate_test_case

router = APIRouter(tags=["Test Cases"])


@router.post("/generate-test-cases")
async def generate_test_cases_stream(project_id: str = Query(...)):
    """
    Streams test cases via Server-Sent Events (SSE).
    Chunks requirements into batches, executes parallel generation,
    validates source quotes, assigns deterministic TC-001... IDs, and streams live progress.
    """
    db: Session = SessionLocal()
    try:
        project = db.query(Project).filter(Project.id == project_id).first()
        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")

        requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
        req_list = [
            {"id": r.id, "title": r.title, "text": r.text, "source_quote": r.source_quote}
            for r in requirements
        ]
        
        ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project_id).first()
        ctx_dict = {
            "roles": ctx.roles if ctx else [],
            "business_rules": ctx.business_rules if ctx else []
        }
    finally:
        db.close()

    async def event_generator():
        yield f"data: {json.dumps({'event': 'start', 'message': 'Initializing scenario generator...'})}\n\n"
        await asyncio.sleep(0.1)

        # Batch requirements (3-4 per batch)
        batch_size = 3
        req_batches = [req_list[i:i + batch_size] for i in range(0, len(req_list), batch_size)] or [[]]
        total_reqs = max(len(req_list), 6)
        generated_cases: List[Dict[str, Any]] = []

        semaphore = asyncio.Semaphore(3)

        async def run_batch(b_idx: int, batch: List[Dict[str, Any]]):
            async with semaphore:
                yield_msg = f"Generating requirements batch {b_idx + 1} of {len(req_batches)}..."
                yield_data = {"event": "progress", "completed_batches": b_idx, "total_batches": len(req_batches), "message": yield_msg}
                return await llm_client.generate_test_cases_batch(batch, ctx_dict, b_idx + 1), yield_data

        for b_idx, batch in enumerate(req_batches):
            yield f"data: {json.dumps({'event': 'progress', 'completed': b_idx * 3, 'total': total_reqs, 'message': f'Analyzing & generating batch {b_idx+1} of {len(req_batches)}...'})}\n\n"
            await asyncio.sleep(0.15)
            
            batch_cases, _ = await run_batch(b_idx, batch)
            generated_cases.extend(batch_cases)

        # Merge, deduplicate, and assign deterministic stable IDs (TC-001, TC-002, ...)
        seen_scenarios = set()
        final_cases = []
        tc_counter = 1

        db_write: Session = SessionLocal()
        try:
            # Clear old test cases for this project
            db_write.query(TestCase).filter(TestCase.project_id == project_id).delete()
            db_write.commit()

            raw_doc = project.raw_text

            for item in generated_cases:
                scen_norm = item.get("scenario", "").strip().lower()
                if scen_norm in seen_scenarios:
                    continue
                seen_scenarios.add(scen_norm)

                tc_id = f"TC-{tc_counter:03d}"
                tc_counter += 1
                item["id"] = tc_id
                item["project_id"] = project_id

                # Run individual deterministic validation & source-quote check
                item_flags = validate_test_case(item, raw_doc)
                item["flags"] = item_flags

                # Save to database
                tc_row = TestCase(
                    id=tc_id,
                    project_id=project_id,
                    requirement_id=item.get("requirement_id"),
                    business_rule_ids=item.get("business_rule_ids", []),
                    scenario=item.get("scenario", ""),
                    scenario_type=item.get("scenario_type", "Positive"),
                    role=item.get("role", "Guest"),
                    priority=item.get("priority", "Medium"),
                    preconditions=item.get("preconditions", []),
                    steps=item.get("steps", []),
                    test_data=item.get("test_data", {}),
                    expected_result=item.get("expected_result", ""),
                    source_quote=item.get("source_quote", ""),
                    status=item.get("status", "Draft"),
                    is_stale=False
                )
                db_write.add(tc_row)

                # Add initial version snapshot for Undo support
                snapshot_data = dict(item)
                v_row = TestCaseVersion(
                    test_case_id=tc_id,
                    project_id=project_id,
                    version_number=1,
                    snapshot=snapshot_data,
                    change_description="Initial generation"
                )
                db_write.add(v_row)

                # Add flags to Flag table
                for f in item_flags:
                    fl_row = Flag(
                        test_case_id=tc_id,
                        project_id=project_id,
                        requirement_id=item.get("requirement_id"),
                        type=f.get("type", "General"),
                        severity=f.get("severity", "Medium"),
                        message=f.get("message", ""),
                        suggested_question=f.get("suggested_question"),
                        suggested_fix=f.get("suggested_fix")
                    )
                    db_write.add(fl_row)

                final_cases.append(item)

                # Stream the newly created test case to client
                yield f"data: {json.dumps({'event': 'test_case', 'data': item})}\n\n"
                await asyncio.sleep(0.04)

            db_write.commit()
        finally:
            db_write.close()

        yield f"data: {json.dumps({'event': 'complete', 'total_generated': len(final_cases), 'message': f'Successfully generated and validated {len(final_cases)} test cases.'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive"}
    )


@router.get("/test-cases", response_model=List[TestCaseResponse])
def get_test_cases(
    project_id: str,
    role: Optional[str] = None,
    scenario_type: Optional[str] = None,
    priority: Optional[str] = None,
    status: Optional[str] = None,
    requirement_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
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

    # Attach flags
    results = []
    for c in cases:
        flags = db.query(Flag).filter(Flag.test_case_id == c.id, Flag.project_id == project_id).all()
        flags_data = [
            {
                "id": f.id,
                "type": f.type,
                "severity": f.severity,
                "message": f.message,
                "suggested_question": f.suggested_question,
                "suggested_fix": f.suggested_fix
            }
            for f in flags
        ]
        
        tc_dict = {
            "id": c.id,
            "project_id": c.project_id,
            "requirement_id": c.requirement_id,
            "business_rule_ids": c.business_rule_ids or [],
            "scenario": c.scenario,
            "scenario_type": c.scenario_type,
            "role": c.role,
            "priority": c.priority,
            "preconditions": c.preconditions or [],
            "steps": c.steps or [],
            "test_data": c.test_data or {},
            "expected_result": c.expected_result,
            "source_quote": c.source_quote or "",
            "status": c.status,
            "is_stale": c.is_stale or False,
            "flags": flags_data,
            "created_at": c.created_at,
            "updated_at": c.updated_at
        }
        results.append(tc_dict)

    return results


@router.patch("/test-cases/{test_case_id}", response_model=TestCaseResponse)
def update_test_case(
    test_case_id: str,
    project_id: str,
    payload: TestCaseUpdate,
    db: Session = Depends(get_db)
):
    tc = db.query(TestCase).filter(TestCase.id == test_case_id, TestCase.project_id == project_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    # Save current state as version snapshot before editing
    latest_ver = db.query(TestCaseVersion).filter(
        TestCaseVersion.test_case_id == test_case_id,
        TestCaseVersion.project_id == project_id
    ).order_by(TestCaseVersion.version_number.desc()).first()

    next_ver_num = (latest_ver.version_number + 1) if latest_ver else 1
    snapshot = {
        "scenario": tc.scenario,
        "scenario_type": tc.scenario_type,
        "role": tc.role,
        "priority": tc.priority,
        "preconditions": tc.preconditions,
        "steps": tc.steps,
        "test_data": tc.test_data,
        "expected_result": tc.expected_result,
        "status": tc.status,
    }
    db.add(TestCaseVersion(
        test_case_id=test_case_id,
        project_id=project_id,
        version_number=next_ver_num,
        snapshot=snapshot,
        change_description="User inline update"
    ))

    # Apply updates
    if payload.scenario is not None:
        tc.scenario = payload.scenario
    if payload.scenario_type is not None:
        tc.scenario_type = payload.scenario_type
    if payload.role is not None:
        tc.role = payload.role
    if payload.priority is not None:
        tc.priority = payload.priority
    if payload.preconditions is not None:
        tc.preconditions = payload.preconditions
    if payload.steps is not None:
        tc.steps = payload.steps
    if payload.test_data is not None:
        tc.test_data = payload.test_data
    if payload.expected_result is not None:
        tc.expected_result = payload.expected_result
    if payload.status is not None:
        tc.status = payload.status
    if payload.is_stale is not None:
        tc.is_stale = payload.is_stale

    db.commit()
    db.refresh(tc)

    # Return with flags
    flags = db.query(Flag).filter(Flag.test_case_id == tc.id, Flag.project_id == project_id).all()
    flags_data = [{"id": f.id, "type": f.type, "severity": f.severity, "message": f.message, "suggested_question": f.suggested_question} for f in flags]

    res = {
        "id": tc.id,
        "project_id": tc.project_id,
        "requirement_id": tc.requirement_id,
        "business_rule_ids": tc.business_rule_ids or [],
        "scenario": tc.scenario,
        "scenario_type": tc.scenario_type,
        "role": tc.role,
        "priority": tc.priority,
        "preconditions": tc.preconditions or [],
        "steps": tc.steps or [],
        "test_data": tc.test_data or {},
        "expected_result": tc.expected_result,
        "source_quote": tc.source_quote or "",
        "status": tc.status,
        "is_stale": tc.is_stale or False,
        "flags": flags_data,
        "created_at": tc.created_at,
        "updated_at": tc.updated_at
    }
    return res


@router.post("/test-cases/{test_case_id}/undo")
def undo_test_case(test_case_id: str, project_id: str, db: Session = Depends(get_db)):
    """
    Restores the previous version snapshot.
    """
    tc = db.query(TestCase).filter(TestCase.id == test_case_id, TestCase.project_id == project_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    versions = db.query(TestCaseVersion).filter(
        TestCaseVersion.test_case_id == test_case_id,
        TestCaseVersion.project_id == project_id
    ).order_by(TestCaseVersion.version_number.desc()).all()

    if len(versions) <= 1:
        raise HTTPException(status_code=400, detail="No earlier versions available to undo.")

    latest = versions[0]
    previous = versions[1]

    # Restore snapshot
    snap = previous.snapshot
    tc.scenario = snap.get("scenario", tc.scenario)
    tc.scenario_type = snap.get("scenario_type", tc.scenario_type)
    tc.role = snap.get("role", tc.role)
    tc.priority = snap.get("priority", tc.priority)
    tc.preconditions = snap.get("preconditions", tc.preconditions)
    tc.steps = snap.get("steps", tc.steps)
    tc.test_data = snap.get("test_data", tc.test_data)
    tc.expected_result = snap.get("expected_result", tc.expected_result)
    tc.status = snap.get("status", tc.status)

    db.delete(latest)
    db.commit()
    db.refresh(tc)

    return {"message": "Reverted to previous version.", "version": previous.version_number}


@router.post("/regenerate-field")
async def regenerate_field(payload: RegenerateFieldRequest, db: Session = Depends(get_db)):
    """
    Regenerates expected_result, steps, or entire row using current edits and instruction.
    """
    tc = db.query(TestCase).filter(TestCase.id == payload.test_case_id, TestCase.project_id == payload.project_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    req = db.query(Requirement).filter(Requirement.id == tc.requirement_id, Requirement.project_id == payload.project_id).first()
    req_text = req.text if req else ""

    current_state = {
        "id": tc.id,
        "scenario": tc.scenario,
        "scenario_type": tc.scenario_type,
        "role": tc.role,
        "steps": tc.steps or [],
        "preconditions": tc.preconditions or [],
        "test_data": tc.test_data or {},
        "expected_result": tc.expected_result
    }

    # Save version before AI regeneration
    latest_ver = db.query(TestCaseVersion).filter(
        TestCaseVersion.test_case_id == tc.id,
        TestCaseVersion.project_id == payload.project_id
    ).order_by(TestCaseVersion.version_number.desc()).first()
    next_ver = (latest_ver.version_number + 1) if latest_ver else 1

    db.add(TestCaseVersion(
        test_case_id=tc.id,
        project_id=payload.project_id,
        version_number=next_ver,
        snapshot=current_state,
        change_description=f"Before regenerate: {payload.target_field}"
    ))

    updated = await llm_client.regenerate_field(
        current_case=current_state,
        requirement_text=req_text,
        target_field=payload.target_field,
        instruction=payload.instruction or ""
    )

    if payload.target_field == "expected_result":
        tc.expected_result = updated.get("expected_result", tc.expected_result)
    elif payload.target_field == "steps":
        tc.steps = updated.get("steps", tc.steps)
    elif payload.target_field == "entire_row":
        tc.expected_result = updated.get("expected_result", tc.expected_result)
        tc.steps = updated.get("steps", tc.steps)
        tc.scenario = updated.get("scenario", tc.scenario)

    db.commit()
    db.refresh(tc)

    return {
        "test_case_id": tc.id,
        "target_field": payload.target_field,
        "expected_result": tc.expected_result,
        "steps": tc.steps,
        "scenario": tc.scenario
    }


@router.delete("/test-cases/{test_case_id}")
def delete_test_case(test_case_id: str, project_id: str, db: Session = Depends(get_db)):
    tc = db.query(TestCase).filter(TestCase.id == test_case_id, TestCase.project_id == project_id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    db.delete(tc)
    db.commit()
    return {"message": "Test case deleted successfully.", "id": test_case_id}


@router.post("/test-cases/bulk")
def bulk_update_test_cases(payload: BulkUpdateTestCasesRequest, db: Session = Depends(get_db)):
    cases = db.query(TestCase).filter(
        TestCase.project_id == payload.project_id,
        TestCase.id.in_(payload.test_case_ids)
    ).all()

    if payload.action == "approve":
        for c in cases:
            c.status = "Approved"
    elif payload.action == "mark_reviewed":
        for c in cases:
            c.status = "Reviewed"
    elif payload.action == "set_priority" and payload.value:
        for c in cases:
            c.priority = payload.value
    elif payload.action == "delete":
        for c in cases:
            db.delete(c)

    db.commit()
    return {"message": f"Bulk action '{payload.action}' applied to {len(cases)} cases."}

# Commit ref: 51
