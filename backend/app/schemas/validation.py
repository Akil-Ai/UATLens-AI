from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any


class SuiteValidationReport(BaseModel):
    project_id: str
    total_test_cases: int
    open_flags_count: int
    quality_score: int = Field(ge=0, le=100)
    flags_by_type: Dict[str, int] = Field(default_factory=dict)
    coverage_gaps: List[str] = Field(default_factory=list)
    clarification_items: List[Dict[str, Any]] = Field(default_factory=list)
