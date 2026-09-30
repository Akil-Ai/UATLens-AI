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
  permission_rule_ids?: string[];
  permission_rule_revision?: number;
  is_blocked?: boolean;
  blocked_reason?: string;
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
  owner_id?: string;
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
  owner_id?: string;
  current_suite_version?: number;
  parsed_structure?: any;
  created_at: string;
  updated_at: string;
  test_case_count?: number;
  flag_count?: number;
}

// ── Clarification Decisions ──────────────────────────────────────────────────

export type ClarificationDecisionStatus = "pending" | "accepted" | "rejected" | "answered";
export type ClarificationLifecycleStatus = "Open" | "Answered" | "Resolved" | "Dismissed";

export interface ClarificationDecision {
  id: string;
  project_id: string;
  requirement_id?: string;
  issue_type: string;
  description: string;
  suggested_question: string;
  source_evidence?: string;
  document_location?: string;
  status?: ClarificationLifecycleStatus | string;
  decision: ClarificationDecisionStatus;
  reviewer_answer?: string;
  dismissal_reason?: string;
  answered_by?: string;
  answered_at?: string;
  confirmed_by?: string;
  confirmed_at?: string;
  dismissed_by?: string;
  dismissed_at?: string;
  reopened_by?: string;
  reopened_at?: string;
  history?: any[];
  is_superseded?: boolean;
  created_at?: string;
  updated_at?: string;
}

// ── Permission Rules ─────────────────────────────────────────────────────────

export type PermissionDecision = "Allowed" | "Denied" | "Unspecified" | "Conflicting" | "allow" | "deny";
export type PermissionReviewStatus = "Draft" | "Confirmed" | "Corrected" | "Superseded";

export interface PermissionRule {
  id: string;
  project_id: string;
  role: string;
  action: string;
  resource?: string;
  scope?: string;
  condition?: string;
  workflow_state?: string;
  decision: PermissionDecision;
  review_status?: PermissionReviewStatus;
  reviewer_notes?: string;
  revision?: number;
  source_quote?: string;
  source_location?: string;
  source_requirement_id?: string;
  source_rule_id?: string;
  is_active?: boolean;
  evidence?: any;
}

export interface PermissionCoverageMetric {
  role: string;
  total_permissions: number;
  allow_count: number;
  deny_count: number;
  tested_allow: number;
  tested_deny: number;
  coverage_pct: number;
}

export interface PermissionCoverageResponse {
  metrics: PermissionCoverageMetric[];
  uncovered_allow: { role: string; action: string }[];
  uncovered_deny: { role: string; action: string }[];
}
