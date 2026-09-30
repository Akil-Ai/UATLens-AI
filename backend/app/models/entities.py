import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Text,
    Integer,
    Boolean,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    JSON,
    Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship
from backend.app.db.base import Base

# Cross-database JSON type: JSONB on PostgreSQL, JSON on SQLite
JSONType = JSON().with_variant(JSONB, "postgresql")


def utc_now():
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, default="Untitled Project")
    raw_text = Column(Text, nullable=False, default="")
    parsed_structure = Column(JSONType, nullable=True, default=dict)
    owner_id = Column(String(36), nullable=True)
    current_suite_version = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_projects_created_at", "created_at"),
        Index("ix_projects_owner_id", "owner_id"),
    )

    requirements = relationship("Requirement", back_populates="project", cascade="all, delete-orphan")
    test_cases = relationship("TestCase", back_populates="project", cascade="all, delete-orphan")
    context = relationship("ExtractedContext", back_populates="project", uselist=False, cascade="all, delete-orphan")
    export_history = relationship("ExportHistory", back_populates="project", cascade="all, delete-orphan")
    clarification_decisions = relationship("ClarificationDecision", back_populates="project", cascade="all, delete-orphan")
    permission_rules = relationship("PermissionRule", back_populates="project", cascade="all, delete-orphan")
    members = relationship("ProjectMember", back_populates="project", cascade="all, delete-orphan")
    suite_versions = relationship("TestSuiteVersion", back_populates="project", cascade="all, delete-orphan")


class ProjectMember(Base):
    """
    Project collaborator membership for multi-user access control.
    Role: owner | editor | viewer
    """
    __tablename__ = "project_members"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(String(36), nullable=False)
    user_email = Column(String(255), nullable=True)
    role = Column(String(30), nullable=False, default="viewer")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_project_members_lookup", "project_id", "user_id", unique=True),
        Index("ix_project_members_user_id", "user_id"),
    )

    project = relationship("Project", back_populates="members")


class TestSuiteVersion(Base):
    """
    Tracks complete test suite versions and generation history.
    """
    __tablename__ = "test_suite_versions"
    __test__ = False

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    model_provider = Column(String(50), nullable=True)
    model_name = Column(String(100), nullable=True)
    target_requirement_id = Column(String(50), nullable=True)
    generation_inputs = Column(JSONType, default=dict)
    status = Column(String(30), nullable=False, default="Completed")
    error_message = Column(Text, nullable=True)
    test_case_count = Column(Integer, nullable=False, default=0)
    snapshot = Column(JSONType, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_test_suite_versions_lookup", "project_id", "version_number"),
    )

    project = relationship("Project", back_populates="suite_versions")


class ExtractedContext(Base):
    __tablename__ = "extracted_contexts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False)
    roles = Column(JSONType, default=list)
    actions = Column(JSONType, default=list)
    business_rules = Column(JSONType, default=list)
    conditions = Column(JSONType, default=list)
    state_changes = Column(JSONType, default=list)
    dependencies = Column(JSONType, default=list)
    ambiguities = Column(JSONType, default=list)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_extracted_contexts_project_id", "project_id"),
    )

    project = relationship("Project", back_populates="context")


class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(String(50), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    title = Column(String(255), nullable=False)
    text = Column(Text, nullable=False)
    source_quote = Column(Text, nullable=False, default="")
    roles_involved = Column(JSONType, default=list)
    expected_outcome = Column(Text, nullable=False, default="")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_requirements_project_id", "project_id"),
    )

    project = relationship("Project", back_populates="requirements")


class TestCase(Base):
    __tablename__ = "test_cases"
    __test__ = False

    id = Column(String(50), primary_key=True)

    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    requirement_id = Column(String(50), nullable=True)
    business_rule_ids = Column(JSONType, default=list)
    scenario = Column(Text, nullable=False)
    scenario_type = Column(String(20), nullable=False)
    role = Column(String(50), nullable=False, default="Guest")
    priority = Column(String(20), nullable=False, default="Medium")
    preconditions = Column(JSONType, default=list)
    steps = Column(JSONType, default=list)
    test_data = Column(JSONType, default=dict)
    expected_result = Column(Text, nullable=False)
    source_quote = Column(Text, nullable=False, default="")
    status = Column(String(30), nullable=False, default="Draft")
    is_stale = Column(Boolean, default=False)
    permission_rule_ids = Column(JSONType, default=list)
    permission_rule_revision = Column(Integer, nullable=True)
    is_blocked = Column(Boolean, default=False)
    blocked_reason = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_test_cases_project_status", "project_id", "status"),
        Index("ix_test_cases_project_req", "project_id", "requirement_id"),
    )

    project = relationship("Project", back_populates="test_cases")
    versions = relationship(
        "TestCaseVersion",
        back_populates="test_case",
        cascade="all, delete-orphan",
        order_by="desc(TestCaseVersion.version_number)",
        foreign_keys="[TestCaseVersion.test_case_id, TestCaseVersion.project_id]",
    )
    flags = relationship(
        "Flag",
        back_populates="test_case",
        cascade="all, delete-orphan",
        foreign_keys="[Flag.test_case_id, Flag.project_id]",
    )


class TestCaseVersion(Base):
    __tablename__ = "test_case_versions"
    __test__ = False

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))

    test_case_id = Column(String(50), nullable=False)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    snapshot = Column(JSONType, nullable=False)
    change_description = Column(String(255), default="Manual edit")
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        ForeignKeyConstraint(
            ["test_case_id", "project_id"],
            ["test_cases.id", "test_cases.project_id"],
            ondelete="CASCADE",
        ),
        Index("ix_test_case_versions_lookup", "project_id", "test_case_id", "version_number"),
    )

    test_case = relationship(
        "TestCase",
        back_populates="versions",
        foreign_keys=[test_case_id, project_id],
    )


class Flag(Base):
    __tablename__ = "flags"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_case_id = Column(String(50), nullable=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    requirement_id = Column(String(50), nullable=True)
    type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False, default="Medium")
    message = Column(Text, nullable=False)
    suggested_question = Column(Text, nullable=True)
    suggested_fix = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        ForeignKeyConstraint(
            ["test_case_id", "project_id"],
            ["test_cases.id", "test_cases.project_id"],
            ondelete="CASCADE",
        ),
        Index("ix_flags_project_tc", "project_id", "test_case_id"),
    )

    test_case = relationship(
        "TestCase",
        back_populates="flags",
        foreign_keys=[test_case_id, project_id],
    )


class ExportHistory(Base):
    __tablename__ = "export_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    format = Column(String(20), nullable=False)
    test_case_count = Column(Integer, default=0)
    exported_at = Column(DateTime(timezone=True), default=utc_now)

    __table_args__ = (
        Index("ix_export_history_project_id", "project_id"),
    )

    project = relationship("Project", back_populates="export_history")


class ClarificationDecision(Base):
    """
    Stores reviewer decisions on AI-detected ambiguities (from ExtractedContext.ambiguities).
    Supports durable lifecycle: Open -> Answered -> Resolved, plus Dismissed with mandatory reason.
    Preserves audit history and links downstream test invalidation.
    """
    __tablename__ = "clarification_decisions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    requirement_id = Column(String(50), nullable=True)   # links to REQ-xxx
    issue_type = Column(String(100), nullable=False)      # e.g. "Vague Term"
    description = Column(Text, nullable=False)
    suggested_question = Column(Text, nullable=False)
    source_evidence = Column(Text, nullable=True)
    document_location = Column(String(150), nullable=True)
    # Lifecycle status: Open | Answered | Resolved | Dismissed
    status = Column(String(30), nullable=False, default="Open")
    # Legacy field preserved for backwards compatibility
    decision = Column(String(30), nullable=False, default="pending")  # pending | accepted | rejected | answered
    reviewer_answer = Column(Text, nullable=True)   # authoritative answer
    dismissal_reason = Column(Text, nullable=True)  # required if dismissed
    # Audit trail
    answered_by = Column(String(100), nullable=True)
    answered_at = Column(DateTime(timezone=True), nullable=True)
    confirmed_by = Column(String(100), nullable=True)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    dismissed_by = Column(String(100), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)
    reopened_by = Column(String(100), nullable=True)
    reopened_at = Column(DateTime(timezone=True), nullable=True)
    history = Column(JSONType, default=list)
    is_superseded = Column(Boolean, default=False)
    superseded_by_id = Column(String(36), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_clarification_decisions_project_id", "project_id"),
        Index("ix_clarification_decisions_status", "project_id", "status"),
    )

    project = relationship("Project", back_populates="clarification_decisions")


class PermissionRule(Base):
    """
    Stores extracted permission rules for role/action/condition analysis.
    Each row represents one permission entry: who can do what, under what condition.
    Decision: Allowed | Denied | Unspecified | Conflicting
    Review Status: Draft | Confirmed | Corrected | Superseded
    """
    __tablename__ = "permission_rules"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    role = Column(String(100), nullable=False)           # e.g. "Admin"
    action = Column(String(255), nullable=False)         # e.g. "Approve refunds"
    resource = Column(String(150), nullable=True)        # e.g. "Refunds"
    scope = Column(String(100), nullable=True)           # e.g. "own records" | "all records"
    condition = Column(Text, nullable=True)               # e.g. "before Shipped"
    workflow_state = Column(String(100), nullable=True)  # e.g. "Pending Payment"
    decision = Column(String(20), nullable=False, default="Allowed")  # Allowed | Denied | Unspecified | Conflicting
    source_quote = Column(Text, nullable=True)
    source_location = Column(String(150), nullable=True)
    source_requirement_id = Column(String(50), nullable=True)       # links to REQ-xxx
    source_rule_id = Column(String(50), nullable=True)              # links to BR-xxx
    review_status = Column(String(30), nullable=False, default="Draft")  # Draft | Confirmed | Corrected | Superseded
    reviewer_notes = Column(Text, nullable=True)
    revision = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    superseded_by_id = Column(String(36), nullable=True)
    evidence = Column(JSONType, default=dict)
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    __table_args__ = (
        Index("ix_permission_rules_project_role", "project_id", "role"),
        Index("ix_permission_rules_decision", "project_id", "decision"),
    )

    project = relationship("Project", back_populates="permission_rules")

