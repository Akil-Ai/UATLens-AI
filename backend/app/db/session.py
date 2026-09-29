import logging
from typing import Optional
from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session
from backend.app.config import settings, normalize_database_url

logger = logging.getLogger("uatlens.db")


def create_db_engine(database_url: Optional[str] = None) -> Engine:
    """
    Creates an appropriately configured SQLAlchemy Engine for either
    PostgreSQL (Supabase) or SQLite.
    """
    raw_url = database_url or settings.resolved_database_url
    url = normalize_database_url(raw_url, require_ssl=settings.DB_REQUIRE_SSL)

    if url.startswith("sqlite"):
        # SQLite-specific connection arguments
        return create_engine(
            url,
            connect_args={"check_same_thread": False},
            echo=False,
        )
    else:
        # PostgreSQL / Supabase connection configuration
        # Pool settings for a persistent server process
        return create_engine(
            url,
            pool_size=settings.DB_POOL_SIZE,
            max_overflow=settings.DB_MAX_OVERFLOW,
            pool_timeout=settings.DB_POOL_TIMEOUT,
            pool_recycle=settings.DB_POOL_RECYCLE,
            pool_pre_ping=settings.DB_POOL_PRE_PING,
            echo=False,
        )


engine = create_db_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db():
    """
    FastAPI dependency that provides a database session and safely closes it after the request.
    """
    db: Session = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def verify_database_connection(target_engine: Optional[Engine] = None) -> dict:
    """
    Tests database connectivity and returns metadata (dialect, server version info).
    Raises an informative ConnectionError if the database is unreachable.
    """
    eng = target_engine or engine
    dialect_name = eng.dialect.name
    try:
        with eng.connect() as conn:
            result = conn.execute(text("SELECT 1")).scalar()
            if result != 1:
                raise ConnectionError("Database test query did not return expected result.")
            return {
                "status": "connected",
                "dialect": dialect_name,
                "url_host": getattr(eng.url, "host", "local"),
            }
    except Exception as e:
        err_msg = f"Failed to connect to database ({dialect_name} at {getattr(eng.url, 'host', 'unknown')}): {e}"
        logger.error(err_msg)
        raise ConnectionError(err_msg) from e

