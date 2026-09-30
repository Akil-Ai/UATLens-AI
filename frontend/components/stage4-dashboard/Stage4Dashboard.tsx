import React, { useMemo, useState, useEffect, useCallback } from "react";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import {
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  TrendingUp,
  FileCheck2,
  ArrowRight,
  Filter,
  AlertTriangle,
  RefreshCw,
  HelpCircle,
  Lock,
  Unlock,
} from "lucide-react";
import { TestCase, PermissionCoverageResponse, ClarificationDecision, RequirementItem } from "@/types";
import { fetchPermissionCoverage, fetchClarificationDecisions, fetchContext } from "@/lib/api";

interface Stage4DashboardProps {
  testCases: TestCase[];
  onFilterGrid: (filterType: string, value: string) => void;
  onProceedToExport: () => void;
  onBackToGrid: () => void;
  onNavigateToStage2?: () => void;
  projectId?: string;
}

export const Stage4Dashboard: React.FC<Stage4DashboardProps> = ({
  testCases,
  onFilterGrid,
  onProceedToExport,
  onBackToGrid,
  onNavigateToStage2,
  projectId,
}) => {
  const [permCoverage, setPermCoverage] = useState<PermissionCoverageResponse | null>(null);
  const [permLoading, setPermLoading] = useState(false);
  const [permError, setPermError] = useState<string | null>(null);

  const [allRequirements, setAllRequirements] = useState<RequirementItem[]>([]);
  const [clarifications, setClarifications] = useState<ClarificationDecision[]>([]);
  const [loadingContext, setLoadingContext] = useState(false);

  // Load permission coverage, all requirements, and clarifications
  const loadData = useCallback(async () => {
    if (!projectId) return;
    setPermLoading(true);
    setPermError(null);
    setLoadingContext(true);

    try {
      const [permData, ctxData, clarData] = await Promise.all([
        fetchPermissionCoverage(projectId).catch(() => null),
        fetchContext(projectId).catch(() => null),
        fetchClarificationDecisions(projectId).catch(() => []),
      ]);

      if (permData) setPermCoverage(permData);
      if (ctxData?.requirements) setAllRequirements(ctxData.requirements);
      if (Array.isArray(clarData)) setClarifications(clarData);
    } catch (err: any) {
      setPermError("Failed to load suite coverage metrics. Please retry.");
    } finally {
      setPermLoading(false);
      setLoadingContext(false);
    }
  }, [projectId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Suite metrics
  const total = testCases.length;
  // Approved coverage only counts Approved tests that are NOT stale
  const approvedCases = testCases.filter((tc) => tc.status === "Approved" && !tc.is_stale);
  const approved = approvedCases.length;
  const staleCount = testCases.filter((tc) => tc.is_stale).length;
  const blockedCount = testCases.filter((tc) => tc.is_blocked).length;
  const needsClarification = testCases.filter((tc) => tc.status === "Needs Clarification").length;
  const totalFlags = testCases.reduce((acc, tc) => acc + (tc.flags ? tc.flags.length : 0), 0);
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

  // Unresolved clarifications count (Open or Answered, not Resolved or Dismissed)
  const unresolvedClarificationsCount = clarifications.filter(
    (c) => c.status !== "Resolved" && c.decision !== "accepted" && c.status !== "Dismissed" && c.decision !== "rejected"
  ).length;

  // All Requirement IDs combined: from context definition + test case mappings
  const allReqIds = useMemo(() => {
    const ids = new Set<string>();
    allRequirements.forEach((r) => ids.add(r.id));
    testCases.forEach((tc) => {
      if (tc.requirement_id) ids.add(tc.requirement_id);
    });
    return Array.from(ids);
  }, [allRequirements, testCases]);

  // Requirement Coverage Breakdown (including zero-test requirements)
  const reqCoverage = useMemo(() => {
    const map: Record<string, { positive: boolean; negative: boolean; boundary: boolean; count: number; approvedCount: number }> = {};
    allReqIds.forEach((rid) => {
      map[rid] = { positive: false, negative: false, boundary: false, count: 0, approvedCount: 0 };
    });

    testCases.forEach((tc) => {
      const rid = tc.requirement_id || "Unmapped";
      if (!map[rid]) {
        map[rid] = { positive: false, negative: false, boundary: false, count: 0, approvedCount: 0 };
      }
      map[rid].count++;
      if (tc.status === "Approved" && !tc.is_stale) {
        map[rid].approvedCount++;
      }
      if (tc.scenario_type === "Positive") map[rid].positive = true;
      if (tc.scenario_type === "Negative") map[rid].negative = true;
      if (tc.scenario_type === "Boundary") map[rid].boundary = true;
    });

    return map;
  }, [allReqIds, testCases]);

  // Covered vs Missing requirements
  const totalReqCount = allReqIds.length;
  const coveredReqCount = Object.values(reqCoverage).filter((c) => c.count > 0).length;
  const approvedReqCount = Object.values(reqCoverage).filter((c) => c.approvedCount > 0).length;
  const generatedReqCoveragePct = totalReqCount > 0 ? Math.round((coveredReqCount / totalReqCount) * 100) : null;
  const approvedReqCoveragePct = totalReqCount > 0 ? Math.round((approvedReqCount / totalReqCount) * 100) : null;

  // Donut: Scenario Type distribution
  const typeData = useMemo(() => {
    const counts: Record<string, number> = { Positive: 0, Negative: 0, Boundary: 0 };
    testCases.forEach((tc) => {
      if (counts[tc.scenario_type] !== undefined) counts[tc.scenario_type]++;
    });
    return [
      { name: "Positive", value: counts.Positive, color: "#10B981" }, // Emerald
      { name: "Negative", value: counts.Negative, color: "#F43F5E" }, // Rose
      { name: "Boundary", value: counts.Boundary, color: "#F59E0B" }, // Amber
    ];
  }, [testCases]);

  // Bar: Priority distribution
  const priorityData = useMemo(() => {
    const counts: Record<string, number> = { High: 0, Medium: 0, Low: 0 };
    testCases.forEach((tc) => {
      if (counts[tc.priority] !== undefined) counts[tc.priority]++;
    });
    return [
      { priority: "High", count: counts.High, fill: "#F43F5E" },
      { priority: "Medium", count: counts.Medium, fill: "#F59E0B" },
      { priority: "Low", count: counts.Low, fill: "#0EA5E9" },
    ];
  }, [testCases]);

  // Bar: Role distribution
  const roleData = useMemo(() => {
    const counts: Record<string, number> = {};
    testCases.forEach((tc) => {
      counts[tc.role] = (counts[tc.role] || 0) + 1;
    });
    return Object.entries(counts).map(([role, count]) => ({
      role,
      count,
    }));
  }, [testCases]);

  // Coverage gaps warnings
  const coverageWarnings = useMemo(() => {
    const warnings: string[] = [];
    Object.entries(reqCoverage).forEach(([rid, cov]) => {
      if (!cov.negative) warnings.push(`${rid} is missing a Negative scenario.`);
      if (!cov.boundary) warnings.push(`${rid} is missing a Boundary test.`);
    });
    return warnings;
  }, [reqCoverage]);

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold mb-2">
              <span>Stage 4 of 5</span>
              <span>•</span>
              <span>Suite Intelligence & Coverage</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              UAT Test Suite Analytics & Traceability
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Accurate requirement coverage, role permission compliance, and quality gate indicators.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToGrid}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors"
            >
              Back to Grid
            </button>
            <button
              onClick={onProceedToExport}
              className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-md shadow-indigo-500/25 flex items-center space-x-2 transition-all"
            >
              <span>Proceed to Export</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Error Banner */}
        {permError && (
          <div className="mt-4 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{permError}</span>
            </div>
            <button
              onClick={loadData}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-semibold hover:bg-rose-700 shadow-xs text-xs"
            >
              Retry Loading
            </button>
          </div>
        )}

        {/* 5 Glass Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5 mt-6">
          {/* Total Cases */}
          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Total Test Cases
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-slate-900">{total}</span>
              <FileCheck2 className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-[10px] text-slate-500">
              {staleCount > 0 ? `${staleCount} stale · ` : ""}{blockedCount > 0 ? `${blockedCount} blocked` : "Active suite"}
            </p>
          </div>

          {/* Requirement Coverage */}
          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Requirement Coverage
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-indigo-600">
                {generatedReqCoveragePct !== null ? `${generatedReqCoveragePct}%` : "N/A"}
              </span>
              <TrendingUp className="w-4 h-4 text-indigo-500" />
            </div>
            <p className="text-[10px] text-slate-500">
              {coveredReqCount} of {totalReqCount || "0"} requirements
            </p>
          </div>

          {/* Approved Coverage */}
          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Approved Coverage
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-emerald-600">
                {approvedReqCoveragePct !== null ? `${approvedReqCoveragePct}%` : "N/A"}
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
            <p className="text-[10px] text-slate-500">
              {approved} approved (stale excluded)
            </p>
          </div>

          {/* Unresolved Clarifications */}
          <div
            onClick={() => onNavigateToStage2 && onNavigateToStage2()}
            className={`p-4 rounded-2xl border shadow-xs space-y-1 transition-all ${
              unresolvedClarificationsCount > 0
                ? "bg-amber-50/70 border-amber-200 hover:bg-amber-100/70 cursor-pointer"
                : "bg-white/80 border-slate-200/80"
            }`}
            title={unresolvedClarificationsCount > 0 ? "Click to resolve in Stage 2" : ""}
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                Open Clarifications
              </span>
              {unresolvedClarificationsCount > 0 && (
                <span className="text-[9px] text-amber-800 font-semibold underline">Stage 2 →</span>
              )}
            </div>
            <div className="flex items-baseline justify-between">
              <span className={`text-2xl font-extrabold ${unresolvedClarificationsCount > 0 ? "text-amber-700" : "text-slate-900"}`}>
                {unresolvedClarificationsCount}
              </span>
              <HelpCircle className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-[10px] text-slate-500">
              {unresolvedClarificationsCount > 0 ? "Require BA resolution" : "All resolved ✓"}
            </p>
          </div>

          {/* Quality Gates / Stale & Blocked */}
          <div className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Quality Checkpoints
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-2xl font-extrabold text-rose-600">
                {staleCount + blockedCount + totalFlags}
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            </div>
            <p className="text-[10px] text-slate-500">
              {staleCount} stale · {blockedCount} blocked
            </p>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Donut Chart: Scenario Types */}
          <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Scenario Type Distribution
              </h4>
              <span className="text-[10px] text-indigo-600 font-semibold cursor-pointer">
                Click segment to filter
              </span>
            </div>
            <div className="h-64 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={typeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                    onClick={(entry) => onFilterGrid("type", entry.name)}
                    cursor="pointer"
                  >
                    {typeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Bar Chart: Priority Distribution */}
          <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Cases by Priority
            </h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={priorityData} margin={{ top: 20, right: 20, left: -20, bottom: 5 }}>
                  <XAxis dataKey="priority" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(255, 255, 255, 0.95)",
                      borderRadius: "12px",
                      border: "1px solid #E2E8F0",
                      fontSize: "12px",
                    }}
                  />
                  <Bar
                    dataKey="count"
                    radius={[8, 8, 0, 0]}
                    onClick={(entry: any) => onFilterGrid("priority", entry.priority)}
                    cursor="pointer"
                  >
                    {priorityData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Roles Distribution Bar */}
        <div className="mt-6 p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
            Cases by Role Allocation
          </h4>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={roleData} margin={{ top: 10, right: 20, left: -20, bottom: 5 }}>
                <XAxis dataKey="role" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "rgba(255, 255, 255, 0.95)",
                    borderRadius: "12px",
                    border: "1px solid #E2E8F0",
                    fontSize: "12px",
                  }}
                />
                <Bar
                  dataKey="count"
                  fill="#6366F1"
                  radius={[8, 8, 0, 0]}
                  onClick={(entry: any) => onFilterGrid("role", entry.role)}
                  cursor="pointer"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Permission Coverage Section */}
        {permCoverage && permCoverage.metrics.length > 0 && (
          <div className="mt-6 p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
                Role Permission Test Coverage
              </h4>
              <button
                onClick={loadData}
                disabled={permLoading}
                className="text-[11px] text-indigo-600 font-semibold hover:underline"
              >
                {permLoading ? "Refreshing..." : "Refresh"}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {permCoverage.metrics.map((metric) => (
                <div key={metric.role} className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                        {metric.role.charAt(0)}
                      </div>
                      <span className="text-xs font-bold text-slate-800">{metric.role}</span>
                    </div>
                    <span className={`text-xs font-extrabold ${
                      metric.coverage_pct >= 80 ? "text-emerald-600" :
                      metric.coverage_pct >= 50 ? "text-amber-600" : "text-rose-600"
                    }`}>
                      {metric.coverage_pct}%
                    </span>
                  </div>
                  {/* Progress bar */}
                  <div className="h-1.5 rounded-full bg-slate-200 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        metric.coverage_pct >= 80 ? "bg-emerald-500" :
                        metric.coverage_pct >= 50 ? "bg-amber-500" : "bg-rose-500"
                      }`}
                      style={{ width: `${metric.coverage_pct}%` }}
                    />
                  </div>
                  <div className="flex items-center space-x-3 text-[10px] text-slate-500">
                    <span>{metric.allow_count} allow rules · {metric.tested_allow} tested</span>
                    <span>·</span>
                    <span>{metric.deny_count} deny rules · {metric.tested_deny} tested</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Uncovered permissions */}
            {(permCoverage.uncovered_allow.length > 0 || permCoverage.uncovered_deny.length > 0) && (
              <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                  Uncovered Permissions — consider adding test cases:
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {permCoverage.uncovered_allow.slice(0, 6).map((u, i) => (
                    <span key={`a-${i}`} className="px-2 py-0.5 rounded bg-emerald-50 border border-emerald-200 text-[10px] text-emerald-800 font-medium">
                      + {u.role}: {u.action.slice(0, 40)}
                    </span>
                  ))}
                  {permCoverage.uncovered_deny.slice(0, 6).map((u, i) => (
                    <span key={`d-${i}`} className="px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-[10px] text-rose-800 font-medium">
                      – {u.role}: {u.action.slice(0, 40)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Requirement Coverage Heatmap Matrix */}
        <div className="mt-6 p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                Per-Requirement Coverage & Gap Analysis
              </h4>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Full project scope (including zero-test requirements). Click any requirement gap to filter in Stage 3.
              </p>
            </div>
            <span className="text-[11px] text-slate-400">
              Positive • Negative • Boundary
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {Object.entries(reqCoverage).map(([rid, cov]) => (
              <div
                key={rid}
                onClick={() => onFilterGrid("requirement", rid)}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer space-y-2 ${
                  cov.count === 0
                    ? "bg-rose-50/50 border-rose-200 hover:bg-rose-50"
                    : cov.approvedCount > 0
                    ? "bg-emerald-50/30 border-emerald-200/80 hover:bg-white"
                    : "bg-slate-50/90 border-slate-200/60 hover:border-indigo-300 hover:bg-white"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold text-slate-800">{rid}</span>
                    {cov.count === 0 ? (
                      <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                        Missing
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">
                        {cov.count} case{cov.count > 1 ? "s" : ""}{cov.approvedCount > 0 ? ` · ${cov.approvedCount} approved` : ""}
                      </span>
                    )}
                  </div>
                  <span className="text-[10px] text-indigo-600 font-semibold">Filter →</span>
                </div>

                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cov.positive
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    + Pos
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cov.negative
                        ? "bg-rose-100 text-rose-800"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    - Neg
                  </span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      cov.boundary
                        ? "bg-amber-100 text-amber-800"
                        : "bg-slate-200 text-slate-400"
                    }`}
                  >
                    ◆ Bnd
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
