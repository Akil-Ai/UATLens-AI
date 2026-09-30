import json
import asyncio
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    TestSuiteVersion,
    Flag,
    ClarificationDecision,
    PermissionRule,
)
from backend.app.schemas.test_case import (
    TestCaseResponse,
    TestCaseUpdate,
    RegenerateFieldRequest,
    BulkUpdateTestCasesRequest,
)
from backend.app.ai.llm_client import llm_client
from backend.app.validation.engine import validate_test_case
from backend.app.core.auth import AuthUser, get_current_user
from backend.app.core.project_access import (
    get_project_viewer,
    get_project_editor,
    check_project_access,
)

router = APIRouter(tags=["Test Cases"])


@router.post("/generate-test-cases")
async def generate_test_cases_stream(
    project_id: str = Query(...),
    target_requirement_id: Optional[str] = Query(None, description="Optional targeted requirement to regenerate"),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Streams test cases via Server-Sent Events (SSE).
    Safe, versioned regeneration:
    - Generates without holding open DB transaction
    - Validates candidates before persistence
    - Swaps active version atomically in a single short transaction
    - Retains previous suite in TestSuiteVersion table
    - Supports targeted regeneration: only regenerates specified requirement, preserving all others!
    - Links exact permission_rule_ids and flags blocked rules
    - Sets generated cases strictly to 'Draft'
    """
    project = check_project_access(project_id, current_user, db, required_role="editor")

    # 1. Read input state without holding transaction open during AI calls
    all_requirements = db.query(Requirement).filter(Requirement.project_id == project_id).all()
    if target_requirement_id:
        reqs_to_generate = [r for r in all_requirements if r.id == target_requirement_id]
        if not reqs_to_generate:
            raise HTTPException(
                status_code=404,
                detail=f"Target requirement '{target_requirement_id}' not found in project."
            )
    else:
        reqs_to_generate = all_requirements

    req_list = [
        {"id": r.id, "title": r.title, "text": r.text, "source_quote": r.source_quote}
        for r in reqs_to_generate
    ]

    ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project_id).first()
    ctx_dict = {
        "roles": ctx.roles if ctx else [],
        "business_rules": ctx.business_rules if ctx else []
    }

    # Load resolved/answered clarifications
    decisions = db.query(ClarificationDecision).filter(
        ClarificationDecision.project_id == project_id,
        ClarificationDecision.status.in_(["Answered", "Resolved"])
    ).all()
    ctx_dict["clarifications"] = [
        {
            "requirement_id": d.requirement_id,
            "question": d.suggested_question,
            "answer": d.reviewer_answer or "",
            "status": d.status
        }
        for d in decisions
    ]

    # Load active permission rules
    perm_rules = db.query(PermissionRule).filter(
        PermissionRule.project_id == project_id,
        PermissionRule.is_active == True
    ).all()
    ctx_dict["permission_rules"] = [
        {
            "id": p.id,
            "role": p.role,
            "action": p.action,
            "resource": p.resource,
            "scope": p.scope,
            "condition": p.condition,
            "decision": p.decision,
            "revision": p.revision
        }
        for p in perm_rules
    ]

    # Snapshot existing active test cases before generation (to preserve in version history)
    existing_tcs = db.query(TestCase).filter(TestCase.project_id == project_id).all()
    existing_snapshot = [
        {
            "id": tc.id,
            "requirement_id": tc.requirement_id,
            "scenario": tc.scenario,
            "scenario_type": tc.scenario_type,
            "role": tc.role,
            "priority": tc.priority,
            "preconditions": tc.preconditions,
            "steps": tc.steps,
            "test_data": tc.test_data,
            "expected_result": tc.expected_result,
            "source_quote": tc.source_quote,
            "status": tc.status,
            "permission_rule_ids": tc.permission_rule_ids,
            "is_blocked": tc.is_blocked,
            "blocked_reason": tc.blocked_reason,
        }
        for tc in existing_tcs
    ]

    raw_doc = project.raw_text
    current_version_num = project.current_suite_version or 1

    async def event_generator():
        yield f"data: {json.dumps({'event': 'start', 'message': 'Initializing safe scenario generation pipeline...'})}\n\n"
        await asyncio.sleep(0.05)

        # Batch requirements
        batch_size = 3
        req_batches = [req_list[i:i + batch_size] for i in range(0, len(req_list), batch_size)] or [[]]
        total_reqs = max(len(req_list), 1)
        generated_cases: List[Dict[str, Any]] = []

        semaphore = asyncio.Semaphore(2)

        async def run_batch(b_idx: int, batch: List[Dict[str, Any]]):
            async with semaphore:
                return await llm_client.generate_test_cases_batch(batch, ctx_dict, b_idx + 1)

        for b_idx, batch in enumerate(req_batches):
            yield f"data: {json.dumps({'event': 'progress', 'completed': b_idx * batch_size, 'total': total_reqs, 'message': f'Analyzing & generating batch {b_idx+1} of {len(req_batches)}...'})}\n\n"
            await asyncio.sleep(0.1)

            try:
                batch_cases = await run_batch(b_idx, batch)
                generated_cases.extend(batch_cases)
            except Exception as batch_err:
                yield f"data: {json.dumps({'event': 'error', 'message': f'Batch generation failed: {str(batch_err)}. Aborting without altering existing tests.'})}\n\n"
                return

        # Map generated test cases to permission rules and determine blocked status
        rule_lookup_by_role_action = {}
        for pr in perm_rules:
            key = (pr.role.lower(), pr.action.lower()[:30])
            rule_lookup_by_role_action[key] = pr

        final_cases = []
        tc_counter = 1
        seen_scenarios = set()

        # If targeted regeneration: determine existing counter offset and retain other cases
        if target_requirement_id:
            untouched_cases = [tc for tc in existing_tcs if tc.requirement_id != target_requirement_id]
            # Max existing ID
            for tc in existing_tcs:
                if tc.id.startswith("TC-"):
                    try:
                        tc_num = int(tc.id.split("-")[1])
                        if tc_num >= tc_counter:
                            tc_counter = tc_num + 1
                    except Exception:
                        pass
        else:
            untouched_cases = []

        # Prepare candidate objects with validation
        candidate_rows = []
        candidate_flags = []
        candidate_versions = []

        for item in generated_cases:
            scen_norm = item.get("scenario", "").strip().lower()
            if scen_norm in seen_scenarios:
                continue
            seen_scenarios.add(scen_norm)

            tc_id = f"TC-{tc_counter:03d}"
            tc_counter += 1
            item["id"] = tc_id
            item["project_id"] = project_id
            item["status"] = "Draft"  # Never automatically mark Reviewed or Approved

            # Link permission rules
            tc_role = item.get("role", "Guest")
            tc_action = item.get("scenario", "")
            linked_rules = []
            is_blocked = False
            blocked_reason = None

            for pr in perm_rules:
                if pr.role.lower() == tc_role.lower() and (
                    pr.action.lower() in tc_action.lower() or
                    any(w in tc_action.lower() for w in pr.action.lower().split()[:2])
                ):
                    linked_rules.append(pr.id)
                    if pr.decision in ("Conflicting", "Unspecified") or pr.review_status == "Draft":
                        is_blocked = True
                        blocked_reason = f"Linked permission rule {pr.id} ({pr.decision}) requires reviewer resolution."

            item["permission_rule_ids"] = linked_rules
            item["is_blocked"] = is_blocked
            item["blocked_reason"] = blocked_reason

            # Validate candidate case
            item_flags = validate_test_case(item, raw_doc)
            item["flags"] = item_flags

            candidate_rows.append(item)

        # 2. ATOMIC SWAP TRANSACTION
        db_write: Session = SessionLocal()
        try:
            # Step A: Archive previous suite into TestSuiteVersion
            if existing_snapshot:
                suite_archive = TestSuiteVersion(
                    id=str(uuid.uuid4()),
                    project_id=project_id,
                    version_number=current_version_num,
                    model_provider=llm_client.provider,
                    model_name=llm_client.model,
                    target_requirement_id=target_requirement_id,
                    generation_inputs={"total_requirements": len(all_requirements), "target": target_requirement_id},
                    status="Completed",
                    test_case_count=len(existing_snapshot),
                    snapshot=existing_snapshot,
                    created_at=datetime.now(timezone.utc)
                )
                db_write.add(suite_archive)

            # Step B: Remove only affected test cases
            if target_requirement_id:
                # Targeted: remove only old tests for this specific requirement
                old_tc_ids = [tc.id for tc in existing_tcs if tc.requirement_id == target_requirement_id]
                if old_tc_ids:
                    db_write.query(Flag).filter(
                        Flag.project_id == project_id,
                        Flag.test_case_id.in_(old_tc_ids)
                    ).delete(synchronize_session=False)
                    db_write.query(TestCaseVersion).filter(
                        TestCaseVersion.project_id == project_id,
                        TestCaseVersion.test_case_id.in_(old_tc_ids)
                    ).delete(synchronize_session=False)
                    db_write.query(TestCase).filter(
                        TestCase.project_id == project_id,
                        TestCase.id.in_(old_tc_ids)
                    ).delete(synchronize_session=False)
            else:
                # Full suite: remove old cases atomically
                db_write.query(Flag).filter(Flag.project_id == project_id).delete(synchronize_session=False)
                db_write.query(TestCaseVersion).filter(TestCaseVersion.project_id == project_id).delete(synchronize_session=False)
                db_write.query(TestCase).filter(TestCase.project_id == project_id).delete(synchronize_session=False)

            # Step C: Insert new test cases
            for item in candidate_rows:
                tc_row = TestCase(
                    id=item["id"],
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
                    status="Draft",
                    is_stale=False,
                    permission_rule_ids=item.get("permission_rule_ids", []),
                    permission_rule_revision=1,
                    is_blocked=item.get("is_blocked", False),
                    blocked_reason=item.get("blocked_reason")
                )
                db_write.add(tc_row)

                # Add initial version snapshot
                db_write.add(TestCaseVersion(
                    test_case_id=item["id"],
                    project_id=project_id,
                    version_number=1,
                    snapshot=dict(item),
                    change_description="Initial generated version"
                ))

                # Add flags
                for f in item.get("flags", []):
                    db_write.add(Flag(
                        test_case_id=item["id"],
                        project_id=project_id,
                        requirement_id=item.get("requirement_id"),
                        type=f.get("type", "General"),
                        severity=f.get("severity", "Medium"),
                        message=f.get("message", ""),
                        suggested_question=f.get("suggested_question"),
                        suggested_fix=f.get("suggested_fix")
                    ))

                final_cases.append(item)

            # Increment suite version on project
            proj_row = db_write.query(Project).filter(Project.id == project_id).first()
            if proj_row:
                proj_row.current_suite_version = current_version_num + 1

            db_write.commit()

        except Exception as insert_err:
            db_write.rollback()
            yield f"data: {json.dumps({'event': 'error', 'message': f'Atomic persistence failed: {str(insert_err)}. The existing test suite was completely preserved.'})}\n\n"
            return
        finally:
            db_write.close()

        # Stream cases to client
        for item in final_cases:
            yield f"data: {json.dumps({'event': 'test_case', 'data': item})}\n\n"
            await asyncio.sleep(0.03)

        yield f"data: {json.dumps({'event': 'complete', 'total_generated': len(final_cases), 'suite_version': current_version_num + 1, 'message': f'Successfully updated suite to version {current_version_num + 1}.'})}\n\n"

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
    project: Project = Depends(get_project_viewer),
    db: Session = Depends(get_db)
):
    """List test cases for the authorized project with filters."""
    query = db.query(TestCase).filter(TestCase.project_id == project.id)
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

    results = []
    for c in cases:
        flags = db.query(Flag).filter(Flag.test_case_id == c.id, Flag.project_id == project.id).all()
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
            "permission_rule_ids": c.permission_rule_ids or [],
            "permission_rule_revision": c.permission_rule_revision,
            "is_blocked": c.is_blocked or False,
            "blocked_reason": c.blocked_reason,
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
    project: Project = Depends(get_project_editor),
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Updates an individual test case, snapshots version, and re-evaluates validation flags.
    """
    tc = db.query(TestCase).filter(TestCase.id == test_case_id, TestCase.project_id == project.id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    # Save version snapshot before mutation
    latest_ver = db.query(TestCaseVersion).filter(
        TestCaseVersion.test_case_id == test_case_id,
        TestCaseVersion.project_id == project.id
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
        "permission_rule_ids": tc.permission_rule_ids,
        "is_blocked": tc.is_blocked,
        "blocked_reason": tc.blocked_reason,
    }
    db.add(TestCaseVersion(
        test_case_id=test_case_id,
        project_id=project.id,
        version_number=next_ver_num,
        snapshot=snapshot,
        change_description=f"Edited by {current_user.email or current_user.id}"
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
    if payload.permission_rule_ids is not None:
        tc.permission_rule_ids = payload.permission_rule_ids
    if payload.is_blocked is not None:
        tc.is_blocked = payload.is_blocked
    if payload.blocked_reason is not None:
        tc.blocked_reason = payload.blocked_reason

    # Re-run validations to clear obsolete flags
    tc_data = {
        "id": tc.id,
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
    }
    new_flags = validate_test_case(tc_data, project.raw_text)

    # Sync flags table for this test case
    db.query(Flag).filter(Flag.test_case_id == tc.id, Flag.project_id == project.id).delete(synchronize_session=False)
    for f in new_flags:
        db.add(Flag(
            test_case_id=tc.id,
            project_id=project.id,
            requirement_id=tc.requirement_id,
            type=f.get("type", "General"),
            severity=f.get("severity", "Medium"),
            message=f.get("message", ""),
            suggested_question=f.get("suggested_question"),
            suggested_fix=f.get("suggested_fix")
        ))

    db.commit()
    db.refresh(tc)

    flags = db.query(Flag).filter(Flag.test_case_id == tc.id, Flag.project_id == project.id).all()
    flags_data = [{"id": f.id, "type": f.type, "severity": f.severity, "message": f.message, "suggested_question": f.suggested_question} for f in flags]

    return {
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
        "permission_rule_ids": tc.permission_rule_ids or [],
        "permission_rule_revision": tc.permission_rule_revision,
        "is_blocked": tc.is_blocked or False,
        "blocked_reason": tc.blocked_reason,
        "flags": flags_data,
        "created_at": tc.created_at,
        "updated_at": tc.updated_at
    }


@router.post("/test-cases/{test_case_id}/undo")
def undo_test_case(
    test_case_id: str,
    project_id: str,
    project: Project = Depends(get_project_editor),
    db: Session = Depends(get_db)
):
    """Restores the previous version snapshot."""
    tc = db.query(TestCase).filter(TestCase.id == test_case_id, TestCase.project_id == project.id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    versions = db.query(TestCaseVersion).filter(
        TestCaseVersion.test_case_id == test_case_id,
        TestCaseVersion.project_id == project.id
    ).order_by(TestCaseVersion.version_number.desc()).all()

    if len(versions) <= 1:
        raise HTTPException(status_code=400, detail="No earlier versions available to undo.")

    latest = versions[0]
    previous = versions[1]

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
async def regenerate_field(
    payload: RegenerateFieldRequest,
    current_user: AuthUser = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Regenerates expected_result, steps, or entire row using live configured LLM
    or clean deterministic synthesis without inventing HTTP codes or external brand strings.
    """
    project = check_project_access(payload.project_id, current_user, db, required_role="editor")

    tc = db.query(TestCase).filter(
        TestCase.id == payload.test_case_id,
        TestCase.project_id == payload.project_id
    ).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    req = db.query(Requirement).filter(
        Requirement.id == tc.requirement_id,
        Requirement.project_id == payload.project_id
    ).first()
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

    # Snapshot version before AI regeneration
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
        change_description=f"Before regenerate {payload.target_field}"
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

    # Never automatically mark reviewed or approved
    tc.status = "Draft"

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
def delete_test_case(
    test_case_id: str,
    project_id: str,
    project: Project = Depends(get_project_editor),
    db: Session = Depends(get_db)
):
    tc = db.query(TestCase).filter(TestCase.id == test_case_id, TestCase.project_id == project.id).first()
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    db.delete(tc)
    db.commit()
    return {"message": "Test case deleted successfully.", "id": test_case_id}


@router.post("/test-cases/bulk")
def bulk_update_test_cases(
    payload: BulkUpdateTestCasesRequest,
    project: Project = Depends(get_project_editor),
    db: Session = Depends(get_db)
):
    # project_id is injected via get_project_editor from query string
    cases = db.query(TestCase).filter(
        TestCase.project_id == project.id,
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
