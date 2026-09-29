from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.app.db.session import get_db
from backend.app.models.entities import Project, ExtractedContext, Requirement
from backend.app.schemas.context import (
    ExtractContextRequest,
    ExtractedContextData,
    UpdateContextRequest
)
from backend.app.ai.llm_client import llm_client

router = APIRouter(tags=["Context"])


@router.post("/extract-context", response_model=ExtractedContextData)
async def extract_context(payload: ExtractContextRequest, db: Session = Depends(get_db)):
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    doc_text = payload.text if payload.text else project.raw_text
    if not doc_text or not doc_text.strip():
        raise HTTPException(status_code=400, detail="Cannot extract context from empty document text.")

    # Call AI LLM client (with schema enforcement and fallback)
    context_data = await llm_client.extract_context(doc_text)

    # Persist or update in database
    existing_ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project.id).first()
    if not existing_ctx:
        existing_ctx = ExtractedContext(project_id=project.id)
        db.add(existing_ctx)

    existing_ctx.roles = [r.model_dump() for r in context_data.roles]
    existing_ctx.actions = [a.model_dump() for a in context_data.actions]
    existing_ctx.business_rules = [b.model_dump() for b in context_data.business_rules]
    existing_ctx.conditions = [c.model_dump() for c in context_data.conditions]
    existing_ctx.state_changes = [s.model_dump() for s in context_data.state_changes]
    existing_ctx.dependencies = [d.model_dump() for d in context_data.dependencies]
    existing_ctx.ambiguities = [amb.model_dump() for amb in context_data.ambiguities]

    # Sync Requirements table
    db.query(Requirement).filter(Requirement.project_id == project.id).delete(synchronize_session=False)
    for req in context_data.requirements:
        r_model = Requirement(
            id=req.id,
            project_id=project.id,
            title=req.title,
            text=req.text,
            source_quote=req.source_quote,
            roles_involved=req.roles_involved,
            expected_outcome=req.expected_outcome
        )
        db.add(r_model)

    db.commit()
    db.refresh(existing_ctx)

    return context_data


@router.get("/context/{project_id}", response_model=ExtractedContextData)
def get_extracted_context(project_id: str, db: Session = Depends(get_db)):
    ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project_id).first()
    if not ctx:
        raise HTTPException(status_code=404, detail="Context not yet extracted for this project.")

    reqs = db.query(Requirement).filter(Requirement.project_id == project_id).all()
    req_items = [
        {
            "id": r.id,
            "title": r.title,
            "text": r.text,
            "source_quote": r.source_quote,
            "roles_involved": r.roles_involved or [],
            "expected_outcome": r.expected_outcome
        }
        for r in reqs
    ]

    return ExtractedContextData(
        roles=ctx.roles or [],
        actions=ctx.actions or [],
        business_rules=ctx.business_rules or [],
        conditions=ctx.conditions or [],
        state_changes=ctx.state_changes or [],
        dependencies=ctx.dependencies or [],
        requirements=req_items,
        ambiguities=ctx.ambiguities or [],
    )


@router.put("/context/{project_id}", response_model=ExtractedContextData)
def update_context(project_id: str, payload: UpdateContextRequest, db: Session = Depends(get_db)):
    ctx = db.query(ExtractedContext).filter(ExtractedContext.project_id == project_id).first()
    if not ctx:
        ctx = ExtractedContext(project_id=project_id)
        db.add(ctx)

    data = payload.context
    ctx.roles = [r.model_dump() for r in data.roles]
    ctx.actions = [a.model_dump() for a in data.actions]
    ctx.business_rules = [b.model_dump() for b in data.business_rules]
    ctx.conditions = [c.model_dump() for c in data.conditions]
    ctx.state_changes = [s.model_dump() for s in data.state_changes]
    ctx.dependencies = [d.model_dump() for d in data.dependencies]
    ctx.ambiguities = [amb.model_dump() for amb in data.ambiguities]

    # Update requirements
    db.query(Requirement).filter(Requirement.project_id == project_id).delete(synchronize_session=False)

    for req in data.requirements:
        r_model = Requirement(
            id=req.id,
            project_id=project_id,
            title=req.title,
            text=req.text,
            source_quote=req.source_quote,
            roles_involved=req.roles_involved,
            expected_outcome=req.expected_outcome
        )
        db.add(r_model)

    db.commit()
    return data
