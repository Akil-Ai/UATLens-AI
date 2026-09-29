export type ScenarioType = "Positive" | "Negative" | "Boundary";
export type PriorityType = "High" | "Medium" | "Low";
export type TestCaseStatus = "Draft" | "Reviewed" | "Approved" | "Needs Clarification";

export interface FlagItem {
  id?: string;
  type: string;
  severity: "Low" | "Medium" | "High";
  message: string;
  suggested_question?: string;
  suggested_fix?: string;
}

export interface TestCase {
  id: string;
  project_id?: string;
  requirement_id?: string;
  business_rule_ids: string[];
  scenario: string;
  scenario_type: ScenarioType;
  role: string;
  priority: PriorityType;
  preconditions: string[];
  steps: string[];
  test_data: Record<string, any>;
  expected_result: string;
  source_quote: string;
  status: TestCaseStatus;
  is_stale?: boolean;
  flags: FlagItem[];
  created_at?: string;
  updated_at?: string;
}

export interface RoleItem {
  name: string;
  description: string;
  permissions: string[];
}

export interface ActionItem {
  role: string;
  action: string;
  requirement_id?: string;
}

export interface BusinessRuleItem {
  id: string;
  text: string;
  source_quote: string;
  category?: string;
}

export interface ConditionItem {
  id: string;
  text: string;
  applies_to?: string;
}

export interface StateChangeItem {
  entity: string;
  from_state: string;
  to_state: string;
  trigger: string;
}

export interface DependencyItem {
  id: string;
  description: string;
  depends_on: string;
}

export interface RequirementItem {
  id: string;
  title: string;
  text: string;
  source_quote: string;
  roles_involved: string[];
  expected_outcome: string;
}

export interface AmbiguityItem {
  requirement_id?: string;
  issue_type: string;
  description: string;
  suggested_question: string;
}

export interface ExtractedContextData {
  roles: RoleItem[];
  actions: ActionItem[];
  business_rules: BusinessRuleItem[];
  conditions: ConditionItem[];
  state_changes: StateChangeItem[];
  dependencies: DependencyItem[];
  requirements: RequirementItem[];
  ambiguities: AmbiguityItem[];
}

export interface ProjectSummary {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  test_case_count: number;
  requirement_count: number;
  flag_count: number;
}

export interface ProjectDetail {
  id: string;
  name: string;
  raw_text: string;
  parsed_structure?: any;
  created_at: string;
  updated_at: string;
  test_case_count?: number;
  flag_count?: number;
}
