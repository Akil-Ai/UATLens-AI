from pydantic import BaseModel, Field, ConfigDict
from typing import List, Dict, Any, Optional
from datetime import datetime


class FlagItem(BaseModel):
    id: Optional[str] = None
    type: str  # e.g. "Unverified Source", "Possible Duplicate", "Missing Precondition Details"
    severity: str = "Medium"  # "Low", "Medium", "High"
    message: str
    suggested_question: Optional[str] = None
    suggested_fix: Optional[str] = None


class TestCaseBase(BaseModel):
    id: str  # e.g. "TC-001"
    requirement_id: Optional[str] = None
    business_rule_ids: List[str] = Field(default_factory=list)
    scenario: str
    scenario_type: str = Field(description="Positive, Negative, Boundary")
    role: str = "Guest"
    priority: str = Field(default="Medium", description="High, Medium, Low")
    preconditions: List[str] = Field(default_factory=list)
    steps: List[str] = Field(default_factory=list)
    test_data: Dict[str, Any] = Field(default_factory=dict)
    expected_result: str
    source_quote: str = ""
    status: str = Field(default="Draft", description="Draft, Reviewed, Approved, Needs Clarification")
    is_stale: bool = False
    flags: List[FlagItem] = Field(default_factory=list)


class TestCaseUpdate(BaseModel):
    scenario: Optional[str] = None
    scenario_type: Optional[str] = None
    role: Optional[str] = None
    priority: Optional[str] = None
    preconditions: Optional[List[str]] = None
    steps: Optional[List[str]] = None
    test_data: Optional[Dict[str, Any]] = None
    expected_result: Optional[str] = None
    status: Optional[str] = None
    is_stale: Optional[bool] = None


class TestCaseResponse(TestCaseBase):
    model_config = ConfigDict(from_attributes=True)

    project_id: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class RegenerateFieldRequest(BaseModel):
    project_id: str
    test_case_id: str
    target_field: str = Field(description="'expected_result', 'steps', or 'entire_row'")
    instruction: Optional[str] = Field(default="", description="Optional user prompt: e.g. make it stricter")


class BulkUpdateTestCasesRequest(BaseModel):
    project_id: str
    test_case_ids: List[str]
    action: str = Field(description="'approve', 'delete', 'set_priority', 'mark_reviewed'")
    value: Optional[str] = None
