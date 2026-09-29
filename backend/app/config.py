from pathlib import Path
from typing import List, Optional
from urllib.parse import urlparse, parse_qs, urlencode, urlunparse
from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
PROJECT_ROOT = BASE_DIR.parent                     # workspace root

# Look for .env in backend/ first, then PROJECT_ROOT
env_candidates = [
    BASE_DIR / ".env",
    PROJECT_ROOT / ".env"
]
env_files = [str(p) for p in env_candidates if p.is_file()] or [str(BASE_DIR / ".env")]


def normalize_database_url(url: Optional[str], require_ssl: bool = True) -> str:
    """
    Normalizes PostgreSQL database URLs to use psycopg 3 driver (postgresql+psycopg://),
    handles URL encoding, and enforces sslmode=require for remote connections.
    """
    if not url:
        return ""
    
    url = url.strip()
    if url.startswith("sqlite"):
        return url

    # Replace postgres:// or plain postgresql:// with postgresql+psycopg://
    if url.startswith("postgres://"):
        url = "postgresql+psycopg://" + url[len("postgres://"):]
    elif url.startswith("postgresql://") and not url.startswith("postgresql+"):
        url = "postgresql+psycopg://" + url[len("postgresql://"):]

    # Enforce sslmode=require for remote hosts if not specified
    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    is_local = hostname in ("localhost", "127.0.0.1", "")
    
    if require_ssl and not is_local:
        query_params = parse_qs(parsed.query)
        if "sslmode" not in query_params:
            query_params["sslmode"] = ["require"]
            new_query = urlencode(query_params, doseq=True)
            url = urlunparse(parsed._replace(query=new_query))

    return url


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=env_files,
        env_file_encoding="utf-8",
        extra="ignore"
    )

    PROJECT_NAME: str = "UATlens AI"
    DEBUG: bool = True
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    DATABASE_URL: str = "sqlite:///./uatlens.db"
    MIGRATION_DATABASE_URL: Optional[str] = None
    SQLITE_SOURCE_PATH: Optional[str] = None
    
    # Connection pool configuration for PostgreSQL
    DB_POOL_SIZE: int = 5
    DB_MAX_OVERFLOW: int = 10
    DB_POOL_TIMEOUT: int = 30
    DB_POOL_RECYCLE: int = 1800
    DB_POOL_PRE_PING: bool = True
    DB_REQUIRE_SSL: bool = True
    DB_SCHEMA: str = "public"

    CORS_ORIGINS: str = "http://localhost:3000,http://127.0.0.1:3000"
    
    LLM_PROVIDER: str = "anthropic"  # "anthropic", "gemini", or "mock"
    LLM_MODEL: str = "claude-3-5-sonnet-20241022"
    ANTHROPIC_API_KEY: str = ""
    GEMINI_API_KEY: str = ""

    @property
    def cors_origin_list(self) -> List[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def is_postgres(self) -> bool:
        return self.DATABASE_URL.startswith("postgresql") or self.DATABASE_URL.startswith("postgres")

    @property
    def resolved_database_url(self) -> str:
        return normalize_database_url(self.DATABASE_URL, require_ssl=self.DB_REQUIRE_SSL)

    @property
    def resolved_migration_database_url(self) -> str:
        target = self.MIGRATION_DATABASE_URL or self.DATABASE_URL
        return normalize_database_url(target, require_ssl=self.DB_REQUIRE_SSL)

    def get_sqlite_source_path(self) -> Optional[Path]:
        """
        Identifies the actual SQLite database path from configuration without creating a new file.
        """
        if self.SQLITE_SOURCE_PATH:
            p = Path(self.SQLITE_SOURCE_PATH)
            if p.is_file():
                return p.resolve()

        # Check project root uatlens.db
        root_db = PROJECT_ROOT / "uatlens.db"
        if root_db.is_file():
            return root_db.resolve()

        # Check backend uatlens.db
        backend_db = BASE_DIR / "uatlens.db"
        if backend_db.is_file():
            return backend_db.resolve()

        # If DATABASE_URL is sqlite, inspect the path
        if self.DATABASE_URL.startswith("sqlite:///"):
            raw_path = self.DATABASE_URL[len("sqlite:///"):]
            p = Path(raw_path)
            if p.is_file():
                return p.resolve()
            if not p.is_absolute():
                candidate1 = (PROJECT_ROOT / p).resolve()
                if candidate1.is_file():
                    return candidate1
                candidate2 = (BASE_DIR / p).resolve()
                if candidate2.is_file():
                    return candidate2

        return None


settings = Settings()

