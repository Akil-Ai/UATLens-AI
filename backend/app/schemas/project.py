from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, Dict, Any, List
from datetime import datetime


class ProjectCreate(BaseModel):
    name: str = Field(default="Untitled Project", max_length=255)
    raw_text: str = Field(default="", max_length=65000)


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    raw_text: Optional[str] = None
    parsed_structure: Optional[Dict[str, Any]] = None


class ProjectResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    raw_text: str
    parsed_structure: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    test_case_count: Optional[int] = 0
    flag_count: Optional[int] = 0


class ProjectSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    created_at: datetime
    updated_at: datetime
    test_case_count: int = 0
    requirement_count: int = 0
    flag_count: int = 0

# Commit ref: 17
