import sys
from pathlib import Path
from logging.config import fileConfig

from sqlalchemy import create_engine, pool
from alembic import context

# Ensure workspace root and backend are in sys.path
BASE_DIR = Path(__file__).resolve().parent.parent  # backend/
PROJECT_ROOT = BASE_DIR.parent                     # workspace root

if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from backend.app.config import settings, normalize_database_url
from backend.app.db.base import Base
import backend.app.models.entities  # Load all models

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Supabase managed schemas to ignore completely
IGNORED_SCHEMAS = {
    "auth",
    "storage",
    "realtime",
    "vault",
    "graphql",
    "graphql_public",
    "pgsodium",
    "pgsodium_masks",
    "extensions",
    "supabase_functions",
    "supabase_migrations",
}

APPLICATION_TABLES = {
    "projects",
    "extracted_contexts",
    "requirements",
    "test_cases",
    "test_case_versions",
    "flags",
    "export_history",
    "alembic_version",
}


def include_name(name, type_, parent_names):
    if type_ == "schema":
        return name not in IGNORED_SCHEMAS
    if type_ == "table":
        # Only manage application tables; leave third-party or Supabase tables alone
        schema = parent_names.get("schema_name")
        if schema and schema in IGNORED_SCHEMAS:
            return False
        return True
    return True


def get_url():
    cmd_url = context.get_x_argument(as_dictionary=True).get("url")
    if cmd_url:
        return normalize_database_url(cmd_url, require_ssl=settings.DB_REQUIRE_SSL)
    url = settings.resolved_migration_database_url
    return url


def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_name=include_name,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    url = get_url()

    connect_args = {}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False

    connectable = create_engine(
        url,
        poolclass=pool.NullPool,
        connect_args=connect_args,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            include_name=include_name,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
