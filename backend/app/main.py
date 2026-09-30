import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from backend.app.config import settings
from backend.app.db.base import Base
from backend.app.db.session import engine
from backend.app.models.entities import Project  # Ensures all models are imported
from backend.app.models.entities import ClarificationDecision, PermissionRule  # noqa: F401
from backend.app.api.health import router as health_router
from backend.app.api.sample import router as sample_router
from backend.app.api.projects import router as projects_router
from backend.app.api.parse import router as parse_router
from backend.app.api.context import router as context_router
from backend.app.api.test_cases import router as test_cases_router
from backend.app.api.validation import router as validation_router
from backend.app.api.export import router as export_router
from backend.app.api.clarifications import router as clarifications_router
from backend.app.api.permissions import router as permissions_router

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("uatlens")

# Database schema is managed via explicit Alembic migrations
# Run: alembic upgrade head (or python -m backend.app.db.migrate_data)


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered User Acceptance Testing (UAT) generator & quality validation platform.",
    version="1.0.0"
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows Next.js local dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["Content-Disposition", "Content-Length"],
)


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global error handling request {request.url}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "code": "INTERNAL_SERVER_ERROR",
            "message": "An unexpected error occurred while processing the request.",
            "details": str(exc) if settings.DEBUG else None
        }
    )


# Mount routers under /api
app.include_router(health_router, prefix="/api")
app.include_router(sample_router, prefix="/api")
app.include_router(projects_router, prefix="/api")
app.include_router(parse_router, prefix="/api")
app.include_router(context_router, prefix="/api")
app.include_router(test_cases_router, prefix="/api")
app.include_router(validation_router, prefix="/api")
app.include_router(export_router, prefix="/api")
app.include_router(clarifications_router, prefix="/api")
app.include_router(permissions_router, prefix="/api")


@app.get("/")
def root():
    return {
        "service": "UATlens AI Backend",
        "documentation": "/docs",
        "health": "/api/health"
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.app.main:app", host=settings.HOST, port=settings.PORT, reload=settings.DEBUG)
