# Supabase PostgreSQL Integration & Migration Guide

This guide details the complete database creation, schema migration, PostgREST security hardening, data migration from SQLite, and verification procedures for **UATlens AI**.

---

## 1. Architecture & Design

### Application & Database Topology
- **Server-Side Access**: The Next.js frontend interacts exclusively with FastAPI backend endpoints (`/api/*`). The frontend does **not** connect directly to Supabase via any client SDK.
- **SQLAlchemy Direct Connection**: FastAPI connects directly to Supabase PostgreSQL using SQLAlchemy 2.0 and the modern `psycopg 3` driver (`postgresql+psycopg://`).
- **PostgREST Isolation**: Supabase exposes tables in the `public` schema via its auto-generated PostgREST Data API. To protect application data, Row Level Security (RLS) is enabled on all tables and all permissions are revoked from the `anon` and `authenticated` roles.
- **FastAPI Authentication Unchanged**: Database-level restrictions protect against unauthorized PostgREST API access; they do not introduce user authentication requirements to existing FastAPI endpoints.
- **Composite Primary Keys & Project Scoping**:
  - `requirements` uses composite primary key `(id, project_id)`.
  - `test_cases` uses composite primary key `(id, project_id)`.
  - `test_case_versions` and `flags` enforce composite foreign keys referencing `test_cases(id, project_id)` with `ON DELETE CASCADE`.
  - Cross-project ID collision (e.g. `TC-001` existing in multiple projects) is fully supported without collision.

---

## 2. Supabase Connection Credentials

### Locating Your Connection Strings
In your [Supabase Dashboard](https://supabase.com/dashboard):
1. Navigate to **Project Settings** -> **Database**.
2. Under **Connection string**, select **URI**.

### Connection Modes:
1. **Direct Connection (Port 5432)**:
   - Format: `postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres`
   - Use if your network environment supports direct IPv6/IPv4 connections to the host.
2. **Session Pooler (Port 5432 - Recommended for Persistent Server & Migrations)**:
   - Format: `postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres`
   - Provides IPv4 connectivity with bounded session pooling.
   - Fully supports DDL schema migrations, prepared statements, and session state.
3. **Transaction Pooler (Port 6543 - DO NOT USE FOR MIGRATIONS)**:
   - Transaction poolers do not support DDL commands (like `ALTER TABLE` or `CREATE INDEX`) or session-level settings. Always use port 5432 for `MIGRATION_DATABASE_URL`.

### URL-Encoding Special Characters in Passwords
If your database password contains characters like `@`, `#`, `$`, `%`, `&`, or `:`, you must URL-encode them:
- `@` -> `%40`
- `#` -> `%23`
- `$` -> `%24`
- `%` -> `%25`
- `&` -> `%26`
- `:` -> `%3A`

*Example:* If password is `Pass@123#`, the encoded string is `Pass%40123%23`.

---

## 3. Local Environment Configuration

Edit `backend/.env` (which is git-ignored):

```env
# ------------------------------------------------------------------------------
# Supabase PostgreSQL Configuration
# ------------------------------------------------------------------------------
# Runtime connection for FastAPI:
DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require

# Dedicated migration connection for Alembic (Direct or Session pooler, port 5432):
MIGRATION_DATABASE_URL=postgresql://postgres.[PROJECT-REF]:[YOUR-PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres?sslmode=require

# Path to existing SQLite database for data migration (optional, auto-detected if omitted):
SQLITE_SOURCE_PATH=./uatlens.db

# Connection Pool Settings:
DB_POOL_SIZE=5
DB_MAX_OVERFLOW=10
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=1800
DB_POOL_PRE_PING=True
DB_REQUIRE_SSL=True
DB_SCHEMA=public
```

> **Important**: The application automatically normalizes `postgres://` or `postgresql://` to `postgresql+psycopg://` and enforces `sslmode=require` for all remote connections.

---

## 4. Schema Migration (Alembic)

Alembic is the single source of truth for the database schema. Runtime startup `Base.metadata.create_all` has been removed.

### Running Schema Migrations

Run from the workspace root:

```powershell
# Using the backend virtual environment:
.\backend\.venv\Scripts\alembic.exe -c backend/alembic.ini upgrade head
```

Or from the `backend/` directory:

```powershell
cd backend
.\.venv\Scripts\alembic.exe upgrade head
```

### What the Migration Creates:
1. `projects`: Project entity with JSONB parsed structure and created_at index.
2. `extracted_contexts`: 1-to-1 project relationship, JSONB roles, rules, conditions, etc.
3. `requirements`: Scoped by composite primary key `(id, project_id)`.
4. `test_cases`: Scoped by composite primary key `(id, project_id)` with status and requirement indexes.
5. `test_case_versions`: Composite foreign key to `test_cases(id, project_id)` with `ON DELETE CASCADE`.
6. `flags`: Composite foreign key to `test_cases(id, project_id)` with `ON DELETE CASCADE`.
7. `export_history`: Foreign key to `projects(id)` with `ON DELETE CASCADE`.
8. **Security Lockdown**:
   - `ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;`
   - `REVOKE ALL ON TABLE <table_name> FROM anon, authenticated;`

---

## 5. Existing Data Migration (SQLite to Supabase)

The migration script safely reads records from your local SQLite database and migrates them into Supabase PostgreSQL.

### Step 5.1: Pre-flight Dry Run (Non-destructive)
Inspect records, validate foreign-key relationships, and verify that there are no conflicts:

```powershell
.\backend\.venv\Scripts\python.exe -m backend.app.db.migrate_data --dry-run
```

Output will show table counts, detected orphans (0), and planned inserts without making any changes.

### Step 5.2: Execute Live Migration
Copy records in strict dependency order inside a transactional block:

```powershell
.\backend\.venv\Scripts\python.exe -m backend.app.db.migrate_data
```

What this does automatically:
- Opens `uatlens.db` strictly read-only (`mode=ro`).
- Creates a timestamped local backup file: `uatlens.db.bak_YYYYMMDD_HHMMSS`.
- Inserts records in dependency order:
  1. `projects`
  2. `extracted_contexts`
  3. `requirements`
  4. `test_cases`
  5. `test_case_versions`
  6. `flags`
  7. `export_history`
- Commits the transaction if all records pass.
- Prints a verification table comparing Source vs Target record counts.

### Step 5.3: Safe Re-runs
If the migration is executed again, it is completely idempotent:
- Existing identical records are **skipped**.
- Target records are **never deleted**.
- Conflicting records are reported without overwriting.

Test safe re-run:
```powershell
.\backend\.venv\Scripts\python.exe -m backend.app.db.migrate_data
```
Expected output: `INSERTED: 0`, `SKIPPED: [Total Records]`, `CONFLICTS: 0`.

---

## 6. Verification & Automated Testing

### 1. Run Dedicated Database Integration Tests
Validates composite primary keys, version undo, JSONB persistence, foreign-key cross-project prevention, cascade deletions, and transaction rollbacks:

```powershell
.\backend\.venv\Scripts\pytest.exe backend/tests/test_database_integration.py -v
```

### 2. Run All Backend Tests
Verifies that existing API endpoints, export functionality, and validation engines continue to pass:

```powershell
.\backend\.venv\Scripts\pytest.exe
```

### 3. Verify Supabase PostgREST Lockdown
In the Supabase SQL Editor, verify that the `anon` role has no permissions:

```sql
SELECT table_name, privilege_type 
FROM information_schema.role_table_grants 
WHERE grantee = 'anon' AND table_schema = 'public';
```
The result will show zero privileges on application tables.

---

## 7. Disaster Recovery & Rollback

### Rollback Database Schema
To revert the latest Alembic revision:

```powershell
.\backend\.venv\Scripts\alembic.exe -c backend/alembic.ini downgrade -1
```

To revert completely to base:

```powershell
.\backend\.venv\Scripts\alembic.exe -c backend/alembic.ini downgrade base
```

### Restoring Local SQLite Database
If you ever need to restore your SQLite database from backup:
```powershell
Copy-Item "uatlens.db.bak_[TIMESTAMP]" "uatlens.db" -Force
```
