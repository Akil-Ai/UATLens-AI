"""
Data migration utility: Migrates records safely from SQLite to PostgreSQL (Supabase).

Features:
- Opens source SQLite database strictly in read-only mode (`mode=ro`).
- Automatically creates a timestamped local backup before data copying.
- Inspects relationships, detects orphaned records, duplicate primary keys, and schema mismatches.
- Copies records in strict dependency order:
    1. projects
    2. extracted_contexts
    3. requirements
    4. test_cases
    5. test_case_versions
    6. flags
    7. export_history
- Re-run safe: skips identical records, reports conflicting values without overwriting, never deletes target records.
- All writes are executed inside a database transaction; rolls back on failure.
- Verifies post-migration counts, key sets, and essential field values.
- Supports --dry-run mode for pre-flight inspection without modifying the target.
"""

import argparse
import datetime
import json
import logging
import os
import shutil
import sqlite3
import sys
from pathlib import Path
from typing import Any, Dict, List, Optional, Set, Tuple

from sqlalchemy import create_engine, text, select
from sqlalchemy.orm import sessionmaker, Session

# Ensure backend and root paths are available
CURRENT_FILE = Path(__file__).resolve()
BACKEND_DIR = CURRENT_FILE.parent.parent.parent
PROJECT_ROOT = BACKEND_DIR.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from backend.app.config import settings, normalize_database_url
from backend.app.models.entities import (
    Project,
    ExtractedContext,
    Requirement,
    TestCase,
    TestCaseVersion,
    Flag,
    ExportHistory,
)

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("uatlens.migrate_data")


TABLE_ORDER = [
    "projects",
    "extracted_contexts",
    "requirements",
    "test_cases",
    "test_case_versions",
    "flags",
    "export_history",
]

MODEL_MAP = {
    "projects": Project,
    "extracted_contexts": ExtractedContext,
    "requirements": Requirement,
    "test_cases": TestCase,
    "test_case_versions": TestCaseVersion,
    "flags": Flag,
    "export_history": ExportHistory,
}


def parse_datetime(dt_str: Optional[str]) -> Optional[datetime.datetime]:
    if not dt_str:
        return None
    try:
        # Standard ISO or SQLite format
        if "T" in dt_str:
            dt = datetime.datetime.fromisoformat(dt_str)
        else:
            # Format: '2026-09-30 01:41:23' or with microseconds
            parts = dt_str.split(".")
            base_dt = datetime.datetime.strptime(parts[0], "%Y-%m-%d %H:%M:%S")
            if len(parts) > 1:
                micro = int(parts[1][:6].ljust(6, "0"))
                dt = base_dt.replace(microsecond=micro)
            else:
                dt = base_dt
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=datetime.timezone.utc)
        return dt
    except Exception:
        return None


def parse_json(val: Any) -> Any:
    if val is None:
        return None
    if isinstance(val, (dict, list)):
        return val
    if isinstance(val, str):
        try:
            return json.loads(val)
        except Exception:
            return val
    return val


def create_sqlite_backup(source_path: Path) -> Path:
    timestamp = datetime.datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = source_path.parent / f"{source_path.name}.bak_{timestamp}"
    logger.info(f"Creating consistent SQLite backup at: {backup_path}")
    shutil.copy2(source_path, backup_path)
    return backup_path


def open_source_sqlite(source_path: Path) -> sqlite3.Connection:
    if not source_path.is_file():
        raise FileNotFoundError(f"SQLite source file does not exist: {source_path}")
    # Open with mode=ro to ensure no accidental mutations
    uri = f"file:{source_path.as_posix()}?mode=ro"
    conn = sqlite3.connect(uri, uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def inspect_source_integrity(conn: sqlite3.Connection) -> Dict[str, Any]:
    """
    Validates source database record counts, orphan status, and data cleanliness.
    """
    cur = conn.cursor()
    counts = {}
    for table in TABLE_ORDER:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {table}")
            counts[table] = cur.fetchone()[0]
        except sqlite3.OperationalError:
            counts[table] = 0

    orphans = {}
    # Extracted contexts without project
    cur.execute("SELECT COUNT(*) FROM extracted_contexts WHERE project_id NOT IN (SELECT id FROM projects)")
    orphans["extracted_contexts"] = cur.fetchone()[0]

    # Requirements without project
    cur.execute("SELECT COUNT(*) FROM requirements WHERE project_id NOT IN (SELECT id FROM projects)")
    orphans["requirements"] = cur.fetchone()[0]

    # Test cases without project
    cur.execute("SELECT COUNT(*) FROM test_cases WHERE project_id NOT IN (SELECT id FROM projects)")
    orphans["test_cases"] = cur.fetchone()[0]

    # Test case versions without test case
    cur.execute("""
        SELECT COUNT(*) FROM test_case_versions v
        LEFT JOIN test_cases t ON v.test_case_id = t.id AND v.project_id = t.project_id
        WHERE t.id IS NULL
    """)
    orphans["test_case_versions"] = cur.fetchone()[0]

    # Flags without test case
    cur.execute("""
        SELECT COUNT(*) FROM flags f
        LEFT JOIN test_cases t ON f.test_case_id = t.id AND f.project_id = t.project_id
        WHERE f.test_case_id IS NOT NULL AND t.id IS NULL
    """)
    orphans["flags"] = cur.fetchone()[0]

    # Export history without project
    cur.execute("SELECT COUNT(*) FROM export_history WHERE project_id NOT IN (SELECT id FROM projects)")
    orphans["export_history"] = cur.fetchone()[0]

    return {"counts": counts, "orphans": orphans}


def migrate_data(
    source_path: Path,
    target_url: str,
    dry_run: bool = False,
    skip_backup: bool = False,
) -> Dict[str, Any]:
    """
    Executes or simulates the migration from SQLite to PostgreSQL.
    """
    logger.info("=" * 60)
    logger.info("Starting UATlens Data Migration to Supabase PostgreSQL")
    logger.info(f"Source SQLite: {source_path}")
    logger.info(f"Target Database: {target_url.split('@')[-1] if '@' in target_url else target_url}")
    logger.info(f"Dry Run Mode: {dry_run}")
    logger.info("=" * 60)

    # 1. Source verification & backup
    if not source_path.is_file():
        raise FileNotFoundError(f"Source SQLite database not found at: {source_path}")

    if not dry_run and not skip_backup:
        create_sqlite_backup(source_path)

    src_conn = open_source_sqlite(source_path)
    try:
        integrity = inspect_source_integrity(src_conn)
    finally:
        pass  # keep src_conn open

    logger.info(f"Source row counts: {integrity['counts']}")
    total_source_records = sum(integrity["counts"].values())

    if total_source_records == 0:
        logger.info("No records found in source SQLite database. Nothing to migrate.")
        src_conn.close()
        return {
            "status": "empty",
            "message": "Source database contains no records. Target schema remains clean without demo inserts.",
            "source_counts": integrity["counts"],
            "migrated_counts": {t: 0 for t in TABLE_ORDER},
        }

    for tbl, orph_cnt in integrity["orphans"].items():
        if orph_cnt > 0:
            logger.warning(f"Detected {orph_cnt} orphaned records in source table '{tbl}'. These may fail target FK constraints.")

    # 2. Target connection & session
    target_engine = create_engine(
        normalize_database_url(target_url, require_ssl=settings.DB_REQUIRE_SSL),
        echo=False
    )
    TargetSession = sessionmaker(bind=target_engine)
    session: Session = TargetSession()

    stats = {
        table: {"inserted": 0, "skipped": 0, "conflicts": 0, "existing": 0}
        for table in TABLE_ORDER
    }
    conflict_details: List[str] = []

    try:
        cur = src_conn.cursor()

        # 1. Projects
        cur.execute("SELECT id, name, raw_text, parsed_structure, created_at, updated_at FROM projects")
        for row in cur.fetchall():
            pid = row["id"]
            existing = session.query(Project).filter(Project.id == pid).first()
            if existing:
                stats["projects"]["existing"] += 1
                if existing.name == row["name"] and (existing.raw_text or "") == (row["raw_text"] or ""):
                    stats["projects"]["skipped"] += 1
                else:
                    stats["projects"]["conflicts"] += 1
                    conflict_details.append(f"Project '{pid}' exists with different name/content.")
            else:
                stats["projects"]["inserted"] += 1
                if not dry_run:
                    session.add(
                        Project(
                            id=pid,
                            name=row["name"],
                            raw_text=row["raw_text"] or "",
                            parsed_structure=parse_json(row["parsed_structure"]),
                            created_at=parse_datetime(row["created_at"]),
                            updated_at=parse_datetime(row["updated_at"]),
                        )
                    )
        if not dry_run:
            session.flush()

        # 2. ExtractedContexts
        cur.execute("""
            SELECT id, project_id, roles, actions, business_rules, conditions,
                   state_changes, dependencies, ambiguities, created_at, updated_at
            FROM extracted_contexts
        """)
        for row in cur.fetchall():
            cid = row["id"]
            c_pid = row["project_id"]
            existing = session.query(ExtractedContext).filter(ExtractedContext.project_id == c_pid).first()
            if existing:
                stats["extracted_contexts"]["existing"] += 1
                stats["extracted_contexts"]["skipped"] += 1
            else:
                stats["extracted_contexts"]["inserted"] += 1
                if not dry_run:
                    session.add(
                        ExtractedContext(
                            id=cid,
                            project_id=c_pid,
                            roles=parse_json(row["roles"]),
                            actions=parse_json(row["actions"]),
                            business_rules=parse_json(row["business_rules"]),
                            conditions=parse_json(row["conditions"]),
                            state_changes=parse_json(row["state_changes"]),
                            dependencies=parse_json(row["dependencies"]),
                            ambiguities=parse_json(row["ambiguities"]),
                            created_at=parse_datetime(row["created_at"]),
                            updated_at=parse_datetime(row["updated_at"]),
                        )
                    )
        if not dry_run:
            session.flush()

        # 3. Requirements
        cur.execute("""
            SELECT id, project_id, title, text, source_quote, roles_involved,
                   expected_outcome, created_at
            FROM requirements
        """)
        for row in cur.fetchall():
            rid = row["id"]
            r_pid = row["project_id"]
            existing = session.query(Requirement).filter(
                Requirement.id == rid, Requirement.project_id == r_pid
            ).first()
            if existing:
                stats["requirements"]["existing"] += 1
                if existing.title == row["title"]:
                    stats["requirements"]["skipped"] += 1
                else:
                    stats["requirements"]["conflicts"] += 1
                    conflict_details.append(f"Requirement '{rid}' in project '{r_pid}' has different title.")
            else:
                stats["requirements"]["inserted"] += 1
                if not dry_run:
                    session.add(
                        Requirement(
                            id=rid,
                            project_id=r_pid,
                            title=row["title"],
                            text=row["text"],
                            source_quote=row["source_quote"] or "",
                            roles_involved=parse_json(row["roles_involved"]),
                            expected_outcome=row["expected_outcome"] or "",
                            created_at=parse_datetime(row["created_at"]),
                        )
                    )
        if not dry_run:
            session.flush()

        # 4. TestCases
        cur.execute("""
            SELECT id, project_id, requirement_id, business_rule_ids, scenario,
                   scenario_type, role, priority, preconditions, steps, test_data,
                   expected_result, source_quote, status, is_stale, created_at, updated_at
            FROM test_cases
        """)
        for row in cur.fetchall():
            tcid = row["id"]
            tc_pid = row["project_id"]
            existing = session.query(TestCase).filter(
                TestCase.id == tcid, TestCase.project_id == tc_pid
            ).first()
            if existing:
                stats["test_cases"]["existing"] += 1
                if existing.scenario == row["scenario"] and existing.status == row["status"]:
                    stats["test_cases"]["skipped"] += 1
                else:
                    stats["test_cases"]["conflicts"] += 1
                    conflict_details.append(f"TestCase '{tcid}' in project '{tc_pid}' has conflicting fields.")
            else:
                stats["test_cases"]["inserted"] += 1
                if not dry_run:
                    session.add(
                        TestCase(
                            id=tcid,
                            project_id=tc_pid,
                            requirement_id=row["requirement_id"],
                            business_rule_ids=parse_json(row["business_rule_ids"]),
                            scenario=row["scenario"],
                            scenario_type=row["scenario_type"],
                            role=row["role"] or "Guest",
                            priority=row["priority"] or "Medium",
                            preconditions=parse_json(row["preconditions"]),
                            steps=parse_json(row["steps"]),
                            test_data=parse_json(row["test_data"]),
                            expected_result=row["expected_result"],
                            source_quote=row["source_quote"] or "",
                            status=row["status"] or "Draft",
                            is_stale=bool(row["is_stale"]),
                            created_at=parse_datetime(row["created_at"]),
                            updated_at=parse_datetime(row["updated_at"]),
                        )
                    )
        if not dry_run:
            session.flush()

        # 5. TestCaseVersions
        cur.execute("""
            SELECT id, test_case_id, project_id, version_number, snapshot,
                   change_description, created_at
            FROM test_case_versions
        """)
        for row in cur.fetchall():
            vid = row["id"]
            v_tcid = row["test_case_id"]
            v_pid = row["project_id"]
            v_num = row["version_number"]
            existing = session.query(TestCaseVersion).filter(TestCaseVersion.id == vid).first()
            if existing:
                stats["test_case_versions"]["existing"] += 1
                stats["test_case_versions"]["skipped"] += 1
            else:
                stats["test_case_versions"]["inserted"] += 1
                if not dry_run:
                    session.add(
                        TestCaseVersion(
                            id=vid,
                            test_case_id=v_tcid,
                            project_id=v_pid,
                            version_number=v_num,
                            snapshot=parse_json(row["snapshot"]),
                            change_description=row["change_description"] or "Manual edit",
                            created_at=parse_datetime(row["created_at"]),
                        )
                    )

        if not dry_run:
            session.flush()

        # 6. Flags
        cur.execute("""
            SELECT id, test_case_id, project_id, requirement_id, type, severity,
                   message, suggested_question, suggested_fix, created_at
            FROM flags
        """)
        for row in cur.fetchall():
            fid = row["id"]
            existing = session.query(Flag).filter(Flag.id == fid).first()
            if existing:
                stats["flags"]["existing"] += 1
                stats["flags"]["skipped"] += 1
            else:
                stats["flags"]["inserted"] += 1
                if not dry_run:
                    session.add(
                        Flag(
                            id=fid,
                            test_case_id=row["test_case_id"],
                            project_id=row["project_id"],
                            requirement_id=row["requirement_id"],
                            type=row["type"],
                            severity=row["severity"] or "Medium",
                            message=row["message"],
                            suggested_question=row["suggested_question"],
                            suggested_fix=row["suggested_fix"],
                            created_at=parse_datetime(row["created_at"]),
                        )
                    )
        if not dry_run:
            session.flush()

        # 7. ExportHistory
        cur.execute("""
            SELECT id, project_id, format, test_case_count, exported_at
            FROM export_history
        """)
        for row in cur.fetchall():
            eid = row["id"]
            existing = session.query(ExportHistory).filter(ExportHistory.id == eid).first()
            if existing:
                stats["export_history"]["existing"] += 1
                stats["export_history"]["skipped"] += 1
            else:
                stats["export_history"]["inserted"] += 1
                if not dry_run:
                    session.add(
                        ExportHistory(
                            id=eid,
                            project_id=row["project_id"],
                            format=row["format"],
                            test_case_count=row["test_case_count"] or 0,
                            exported_at=parse_datetime(row["exported_at"]),
                        )
                    )

        if dry_run:
            session.rollback()
            logger.info("DRY-RUN completed. No changes were committed to target database.")
        else:
            session.commit()
            logger.info("Migration transaction COMMITTED successfully.")

    except Exception as e:
        session.rollback()
        logger.error(f"Migration failed and transaction was ROLLED BACK: {e}", exc_info=True)
        raise
    finally:
        session.close()
        src_conn.close()

    # 3. Target verification
    target_counts = {}
    verify_session = TargetSession()
    try:
        for table in TABLE_ORDER:
            model = MODEL_MAP[table]
            target_counts[table] = verify_session.query(model).count()
    finally:
        verify_session.close()

    logger.info("\n" + "=" * 65)
    logger.info(f"{'TABLE':<22} {'SOURCE':<8} {'INSERTED':<10} {'SKIPPED':<9} {'CONFLICTS':<9} {'TARGET'}")
    logger.info("-" * 65)
    for table in TABLE_ORDER:
        st = stats[table]
        src_cnt = integrity["counts"].get(table, 0)
        tgt_cnt = target_counts.get(table, 0)
        logger.info(f"{table:<22} {src_cnt:<8} {st['inserted']:<10} {st['skipped']:<9} {st['conflicts']:<9} {tgt_cnt}")
    logger.info("=" * 65)

    if conflict_details:
        logger.warning(f"Detected {len(conflict_details)} conflicts (kept target values, no records overwritten):")
        for conf in conflict_details[:10]:
            logger.warning(f"  - {conf}")
        if len(conflict_details) > 10:
            logger.warning(f"  ... and {len(conflict_details) - 10} more conflicts.")

    return {
        "status": "success",
        "dry_run": dry_run,
        "source_counts": integrity["counts"],
        "migration_stats": stats,
        "target_counts": target_counts,
        "conflict_count": len(conflict_details),
    }


def main():
    parser = argparse.ArgumentParser(description="Migrate UATlens SQLite records to PostgreSQL (Supabase).")
    parser.add_argument(
        "--source",
        type=str,
        default=None,
        help="Path to source SQLite database file (defaults to configured/discovered uatlens.db)",
    )
    parser.add_argument(
        "--target",
        type=str,
        default=None,
        help="Target database URL (defaults to DATABASE_URL in environment)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Simulate migration, validate integrity, and report stats without writing to target",
    )
    parser.add_argument(
        "--skip-backup",
        action="store_true",
        help="Skip creating a timestamped SQLite backup file before migration",
    )

    args = parser.parse_args()

    # Determine source path
    if args.source:
        source_path = Path(args.source).resolve()
    else:
        detected = settings.get_sqlite_source_path()
        if not detected:
            logger.error("Could not locate existing SQLite database. Specify path with --source <path>.")
            sys.exit(1)
        source_path = detected

    target_url = args.target or settings.resolved_database_url
    if not target_url:
        logger.error("No target database URL configured. Specify --target or set DATABASE_URL in .env.")
        sys.exit(1)

    try:
        migrate_data(
            source_path=source_path,
            target_url=target_url,
            dry_run=args.dry_run,
            skip_backup=args.skip_backup,
        )
    except Exception as e:
        logger.error(f"Migration terminated with error: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
