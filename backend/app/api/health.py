import os
from fastapi import APIRouter
from backend.app.config import settings

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "llm_provider": settings.LLM_PROVIDER,
        "llm_model": settings.LLM_MODEL,
        "has_anthropic_key": bool(settings.ANTHROPIC_API_KEY),
        "has_gemini_key": bool(settings.GEMINI_API_KEY),
        "environment": os.getenv("ENV", "development"),
    }

