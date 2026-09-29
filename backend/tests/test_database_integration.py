"""
Focused integration tests for Supabase PostgreSQL database integration.
Tests composite primary keys, JSONB data persistence, cascade deletions,
foreign key constraints, transaction rollbacks, and connection normalization.
"""

import uuid
import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.exc import IntegrityError

from backend.app.config import normalize_database_url, Settings
from backend.app.models.entities import (
    Base,
    Project,
    ExtractedContext,
    Requirement,
    TestCase,
    TestCaseVersion,
    Flag,
    ExportHistory,
)


@pytest.fixture
def test_db():
    """
    Creates an isolated in-memory test database with foreign keys enabled.
    """
    engine = create_engine(
        "sqlite:///:memory:",
        connect_args={"check_same_thread": False},
        echo=False
    )
    # Enable SQLite foreign key enforcement for testing cascade and FK integrity
    with engine.connect() as conn:
        conn.exec_driver_sql("PRAGMA foreign_keys = ON;")

    Base.metadata.create_all(engine)
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = TestingSessionLocal()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(engine)


def test_connection_url_normalization():
    """Verify driver mapping, password encoding, and sslmode enforcement."""
    # 1. postgres:// -> postgresql+psycopg://
    url1 = "postgres://usr:p%40ss@aws-0-us-west-1.pooler.supabase.com:5432/postgres"
    norm1 = normalize_database_url(url1)
    assert norm1.startswith("postgresql+psycopg://")
    assert "sslmode=require" in norm1
    assert "usr:p%40ss" in norm1

    # 2. postgresql:// -> postgresql+psycopg://
    url2 = "postgresql://usr:secret@db.xyz.supabase.co:5432/postgres?options=foo"
    norm2 = normalize_database_url(url2)
    assert norm2.startswith("postgresql+psycopg://")
    assert "sslmode=require" in norm2
    assert "options=foo" in norm2

    # 3. Localhost does not force sslmode
    url3 = "postgresql://postgres:secret@localhost:5432/testdb"
    norm3 = normalize_database_url(url3)
    assert norm3.startswith("postgresql+psycopg://")
    assert "sslmode=require" not in norm3

    # 4. SQLite is untouched
    url_sqlite = "sqlite:///./uatlens.db"
    assert normalize_database_url(url_sqlite) == url_sqlite


def test_composite_pk_no_collision_between_projects(test_db: Session):
    """
    Two distinct projects can both possess REQ-001 and TC-001 without collision.
    """
    p1 = Project(id="proj-alpha", name="Alpha System")
    p2 = Project(id="proj-beta", name="Beta System")
    test_db.add_all([p1, p2])
    test_db.commit()

    # Create REQ-001 in Project 1
    r1 = Requirement(
        id="REQ-001",
        project_id="proj-alpha",
        title="Alpha Login",
        text="Alpha login requirement",
        roles_involved=["Admin"],
        expected_outcome="Logged into Alpha"
    )
    # Create REQ-001 in Project 2
    r2 = Requirement(
        id="REQ-001",
        project_id="proj-beta",
        title="Beta Login",
        text="Beta login requirement",
        roles_involved=["Customer"],
        expected_outcome="Logged into Beta"
    )
    test_db.add_all([r1, r2])
    test_db.commit()

    # Create TC-001 in Project 1
    tc1 = TestCase(
        id="TC-001",
        project_id="proj-alpha",
        requirement_id="REQ-001",
        scenario="Alpha scenario",
        scenario_type="Positive",
        role="Admin",
        priority="High",
        expected_result="Alpha success"
    )
    # Create TC-001 in Project 2
    tc2 = TestCase(
        id="TC-001",
        project_id="proj-beta",
        requirement_id="REQ-001",
        scenario="Beta scenario",
        scenario_type="Negative",
        role="Customer",
        priority="Low",
        expected_result="Beta success"
    )
    test_db.add_all([tc1, tc2])
    test_db.commit()

    # Verify both exist independently
    found_tc1 = test_db.query(TestCase).filter(TestCase.id == "TC-001", TestCase.project_id == "proj-alpha").first()
    found_tc2 = test_db.query(TestCase).filter(TestCase.id == "TC-001", TestCase.project_id == "proj-beta").first()
    assert found_tc1 is not None and found_tc1.scenario == "Alpha scenario"
    assert found_tc2 is not None and found_tc2.scenario == "Beta scenario"


def test_context_and_json_persistence(test_db: Session):
    """
    Verifies JSON lists and dictionaries persist and retrieve intact.
    """
    proj = Project(
        id="proj-json-test",
        name="JSON Test Project",
        parsed_structure={"modules": ["auth", "checkout"], "version": 2}
    )
    test_db.add(proj)
    test_db.commit()

    ctx = ExtractedContext(
        project_id="proj-json-test",
        roles=[{"role": "Buyer", "description": "Places orders"}],
        business_rules=[{"id": "BR-01", "rule": "Orders over $50 get free shipping"}],
        conditions=[{"if": "total > 50", "then": "free_shipping"}],
        dependencies=[{"from": "Cart", "to": "Checkout"}]
    )
    test_db.add(ctx)
    test_db.commit()

    retrieved = test_db.query(ExtractedContext).filter(ExtractedContext.project_id == "proj-json-test").first()
    assert retrieved is not None
    assert retrieved.roles[0]["role"] == "Buyer"
    assert retrieved.business_rules[0]["id"] == "BR-01"
    assert retrieved.conditions[0]["then"] == "free_shipping"


def test_version_history_and_undo(test_db: Session):
    """
    Verifies that multiple versions of a test case can be stored and restored.
    """
    proj = Project(id="proj-ver", name="Version Test Project")
    tc = TestCase(
        id="TC-001",
        project_id="proj-ver",
        scenario="Original Scenario",
        scenario_type="Positive",
        role="Guest",
        priority="Medium",
        expected_result="Original Expected"
    )
    test_db.add_all([proj, tc])
    test_db.commit()

    # Add Version 1
    v1 = TestCaseVersion(
        test_case_id="TC-001",
        project_id="proj-ver",
        version_number=1,
        snapshot={"scenario": "Original Scenario", "expected_result": "Original Expected"},
        change_description="Initial"
    )
    test_db.add(v1)
    test_db.commit()

    # Update TestCase and add Version 2
    tc.scenario = "Updated Scenario"
    v2 = TestCaseVersion(
        test_case_id="TC-001",
        project_id="proj-ver",
        version_number=2,
        snapshot={"scenario": "Updated Scenario", "expected_result": "Original Expected"},
        change_description="Updated description"
    )
    test_db.add(v2)
    test_db.commit()

    versions = test_db.query(TestCaseVersion).filter(
        TestCaseVersion.test_case_id == "TC-001",
        TestCaseVersion.project_id == "proj-ver"
    ).order_by(TestCaseVersion.version_number.desc()).all()

    assert len(versions) == 2
    assert versions[0].version_number == 2
    assert versions[1].version_number == 1

    # Simulate Undo: restore snapshot of version 1
    snap = versions[1].snapshot
    tc.scenario = snap["scenario"]
    test_db.delete(versions[0])
    test_db.commit()

    reloaded_tc = test_db.query(TestCase).filter(TestCase.id == "TC-001", TestCase.project_id == "proj-ver").first()
    assert reloaded_tc.scenario == "Original Scenario"
    assert test_db.query(TestCaseVersion).filter(TestCaseVersion.project_id == "proj-ver").count() == 1


def test_cascade_deletion(test_db: Session):
    """
    Deleting a Project cleanly cascades to contexts, requirements, test cases, versions, flags, and export histories.
    """
    p = Project(id="proj-cascade", name="Cascade Project")
    test_db.add(p)
    test_db.commit()

    ctx = ExtractedContext(project_id="proj-cascade", roles=[{"role": "User"}])
    req = Requirement(id="REQ-001", project_id="proj-cascade", title="Title", text="Text", expected_outcome="Out")
    tc = TestCase(
        id="TC-001",
        project_id="proj-cascade",
        scenario="Scenario",
        scenario_type="Positive",
        expected_result="Exp"
    )
    test_db.add_all([ctx, req, tc])
    test_db.commit()

    v = TestCaseVersion(
        test_case_id="TC-001",
        project_id="proj-cascade",
        version_number=1,
        snapshot={"scenario": "Scenario"}
    )
    fl = Flag(
        test_case_id="TC-001",
        project_id="proj-cascade",
        type="Ambiguity",
        severity="High",
        message="Unclear text"
    )
    exp = ExportHistory(project_id="proj-cascade", format="xlsx", test_case_count=1)
    test_db.add_all([v, fl, exp])
    test_db.commit()

    # Delete project
    test_db.delete(p)
    test_db.commit()

    # Verify all child records are removed
    assert test_db.query(ExtractedContext).filter(ExtractedContext.project_id == "proj-cascade").count() == 0
    assert test_db.query(Requirement).filter(Requirement.project_id == "proj-cascade").count() == 0
    assert test_db.query(TestCase).filter(TestCase.project_id == "proj-cascade").count() == 0
    assert test_db.query(TestCaseVersion).filter(TestCaseVersion.project_id == "proj-cascade").count() == 0
    assert test_db.query(Flag).filter(Flag.project_id == "proj-cascade").count() == 0
    assert test_db.query(ExportHistory).filter(ExportHistory.project_id == "proj-cascade").count() == 0


def test_transaction_rollback_on_failure(test_db: Session):
    """
    Failed writes roll back cleanly without leaving partial records.
    """
    p = Project(id="proj-atomic", name="Atomic Project")
    test_db.add(p)
    test_db.commit()

    initial_count = test_db.query(Requirement).filter(Requirement.project_id == "proj-atomic").count()

    try:
        # Add valid requirement
        req1 = Requirement(id="REQ-001", project_id="proj-atomic", title="Valid 1", text="Text 1", expected_outcome="Out")
        test_db.add(req1)
        test_db.flush()

        # Add duplicate requirement with same primary key to trigger IntegrityError
        req_dup = Requirement(id="REQ-001", project_id="proj-atomic", title="Duplicate", text="Text Dup", expected_outcome="Out")
        test_db.add(req_dup)
        test_db.flush()

        test_db.commit()
    except IntegrityError:
        test_db.rollback()

    # Verify nothing was committed
    final_count = test_db.query(Requirement).filter(Requirement.project_id == "proj-atomic").count()
    assert final_count == initial_count
