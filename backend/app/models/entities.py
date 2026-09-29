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
)
from sqlalchemy.orm import relationship
from backend.app.db.base import Base


def utc_now():
    return datetime.now(timezone.utc)


class Project(Base):
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, default="Untitled Project")
    raw_text = Column(Text, nullable=False, default="")
    parsed_structure = Column(JSON, nullable=True, default=dict)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    requirements = relationship("Requirement", back_populates="project", cascade="all, delete-orphan")
    test_cases = relationship("TestCase", back_populates="project", cascade="all, delete-orphan")
    context = relationship("ExtractedContext", back_populates="project", uselist=False, cascade="all, delete-orphan")
    export_history = relationship("ExportHistory", back_populates="project", cascade="all, delete-orphan")


class ExtractedContext(Base):
    __tablename__ = "extracted_contexts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), unique=True, nullable=False)
    roles = Column(JSON, default=list)
    actions = Column(JSON, default=list)
    business_rules = Column(JSON, default=list)
    conditions = Column(JSON, default=list)
    state_changes = Column(JSON, default=list)
    dependencies = Column(JSON, default=list)
    ambiguities = Column(JSON, default=list)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="context")


class Requirement(Base):
    __tablename__ = "requirements"

    id = Column(String(50), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    title = Column(String(255), nullable=False)
    text = Column(Text, nullable=False)
    source_quote = Column(Text, nullable=False, default="")
    roles_involved = Column(JSON, default=list)
    expected_outcome = Column(Text, nullable=False, default="")
    created_at = Column(DateTime, default=utc_now)

    project = relationship("Project", back_populates="requirements")


class TestCase(Base):
    __tablename__ = "test_cases"

    id = Column(String(50), primary_key=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    requirement_id = Column(String(50), nullable=True)
    business_rule_ids = Column(JSON, default=list)
    scenario = Column(Text, nullable=False)
    scenario_type = Column(String(20), nullable=False)
    role = Column(String(50), nullable=False, default="Guest")
    priority = Column(String(20), nullable=False, default="Medium")
    preconditions = Column(JSON, default=list)
    steps = Column(JSON, default=list)
    test_data = Column(JSON, default=dict)
    expected_result = Column(Text, nullable=False)
    source_quote = Column(Text, nullable=False, default="")
    status = Column(String(30), nullable=False, default="Draft")
    is_stale = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utc_now)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now)

    project = relationship("Project", back_populates="test_cases")
    versions = relationship("TestCaseVersion", back_populates="test_case", cascade="all, delete-orphan", order_by="desc(TestCaseVersion.version_number)")
    flags = relationship("Flag", back_populates="test_case", cascade="all, delete-orphan")


class TestCaseVersion(Base):
    __tablename__ = "test_case_versions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_case_id = Column(String(50), nullable=False)
    project_id = Column(String(36), nullable=False)
    version_number = Column(Integer, nullable=False, default=1)
    snapshot = Column(JSON, nullable=False)
    change_description = Column(String(255), default="Manual edit")
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        ForeignKeyConstraint(
            ["test_case_id", "project_id"],
            ["test_cases.id", "test_cases.project_id"],
            ondelete="CASCADE",
        ),
    )

    test_case = relationship("TestCase", back_populates="versions")


class Flag(Base):
    __tablename__ = "flags"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    test_case_id = Column(String(50), nullable=True)
    project_id = Column(String(36), nullable=False)
    requirement_id = Column(String(50), nullable=True)
    type = Column(String(50), nullable=False)
    severity = Column(String(20), nullable=False, default="Medium")
    message = Column(Text, nullable=False)
    suggested_question = Column(Text, nullable=True)
    suggested_fix = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now)

    __table_args__ = (
        ForeignKeyConstraint(
            ["test_case_id", "project_id"],
            ["test_cases.id", "test_cases.project_id"],
            ondelete="CASCADE",
        ),
    )

    test_case = relationship("TestCase", back_populates="flags")


class ExportHistory(Base):
    __tablename__ = "export_history"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    format = Column(String(20), nullable=False)
    test_case_count = Column(Integer, default=0)
    exported_at = Column(DateTime, default=utc_now)

    project = relationship("Project", back_populates="export_history")

# Commit ref: 15
