from pydantic import BaseModel, Field
from typing import List, Optional


class RoleItem(BaseModel):
    name: str = Field(description="Role name, e.g. Guest, Registered Customer, Admin")
    description: str = Field(description="Summary of the role's scope")
    permissions: List[str] = Field(default_factory=list, description="List of permitted actions")


class ActionItem(BaseModel):
    role: str
    action: str
    requirement_id: Optional[str] = None


class BusinessRuleItem(BaseModel):
    id: str = Field(description="e.g. BR-001")
    text: str = Field(description="Rule statement")
    source_quote: str = Field(description="Verbatim quote from requirements")
    category: Optional[str] = Field(default="General", description="Category e.g. Validation, Pricing, Security")


class ConditionItem(BaseModel):
    id: str = Field(description="e.g. COND-001")
    text: str = Field(description="Condition specification")
    applies_to: Optional[str] = Field(default="", description="Scope or entity")


class StateChangeItem(BaseModel):
    entity: str = Field(description="e.g. Order")
    from_state: str = Field(description="Initial state")
    to_state: str = Field(description="Target state")
    trigger: str = Field(description="Trigger action/event")


class DependencyItem(BaseModel):
    id: str = Field(description="e.g. DEP-001")
    description: str
    depends_on: str


class RequirementItem(BaseModel):
    id: str = Field(description="e.g. REQ-001")
    title: str
    text: str
    source_quote: str
    roles_involved: List[str] = Field(default_factory=list)
    expected_outcome: str


class AmbiguityItem(BaseModel):
    requirement_id: Optional[str] = None
    issue_type: str = Field(description="e.g. Vague Term, Missing Precondition, Missing Limit")
    description: str
    suggested_question: str


class ExtractedContextData(BaseModel):
    roles: List[RoleItem] = Field(default_factory=list)
    actions: List[ActionItem] = Field(default_factory=list)
    business_rules: List[BusinessRuleItem] = Field(default_factory=list)
    conditions: List[ConditionItem] = Field(default_factory=list)
    state_changes: List[StateChangeItem] = Field(default_factory=list)
    dependencies: List[DependencyItem] = Field(default_factory=list)
    requirements: List[RequirementItem] = Field(default_factory=list)
    ambiguities: List[AmbiguityItem] = Field(default_factory=list)


class ExtractContextRequest(BaseModel):
    project_id: str
    text: Optional[str] = None


class UpdateContextRequest(BaseModel):
    context: ExtractedContextData
