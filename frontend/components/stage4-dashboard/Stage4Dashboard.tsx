"use client";

import React, { useMemo } from "react";
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
} from "lucide-react";
import { TestCase } from "@/types";

interface Stage4DashboardProps {
  testCases: TestCase[];
  onFilterGrid: (filterType: string, value: string) => void;
  onProceedToExport: () => void;
  onBackToGrid: () => void;
}

export const Stage4Dashboard: React.FC<Stage4DashboardProps> = ({
  testCases,
  onFilterGrid,
  onProceedToExport,
  onBackToGrid,
}) => {
  // Metrics calculation
  const total = testCases.length;
  const approved = testCases.filter((tc) => tc.status === "Approved").length;
  const needsClarification = testCases.filter((tc) => tc.status === "Needs Clarification").length;
  const totalFlags = testCases.reduce((acc, tc) => acc + (tc.flags ? tc.flags.length : 0), 0);
  const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0;

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

  // Requirement Coverage Matrix
  const reqCoverage = useMemo(() => {
    const map: Record<string, { positive: boolean; negative: boolean; boundary: boolean }> = {};
    testCases.forEach((tc) => {
      const rid = tc.requirement_id || "Unmapped";
      if (!map[rid]) map[rid] = { positive: false, negative: false, boundary: false };
      if (tc.scenario_type === "Positive") map[rid].positive = true;
      if (tc.scenario_type === "Negative") map[rid].negative = true;
      if (tc.scenario_type === "Boundary") map[rid].boundary = true;
    });
    return map;
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
              UAT Test Suite Analytics
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Visual validation distribution, role allocation, and requirement coverage analysis.
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

        {/* 4 Glass Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {/* Total Cases */}
          <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Total Test Cases
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-slate-900">{total}</span>
              <FileCheck2 className="w-5 h-5 text-indigo-500" />
            </div>
            <p className="text-[11px] text-slate-500">Structured & verified</p>
          </div>

          {/* Approved */}
          <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Approval Rate
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-emerald-600">{approvalRate}%</span>
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            </div>
            <p className="text-[11px] text-slate-500">{approved} approved of {total}</p>
          </div>

          {/* Open Flags */}
          <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Open Flags
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-amber-600">{totalFlags}</span>
              <AlertTriangle className="w-5 h-5 text-amber-500" />
            </div>
            <p className="text-[11px] text-slate-500">Quality checkpoints detected</p>
          </div>

          {/* Needs Clarification */}
          <div className="p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Needs Clarification
            </span>
            <div className="flex items-baseline justify-between">
              <span className="text-3xl font-extrabold text-purple-600">{needsClarification}</span>
              <AlertCircle className="w-5 h-5 text-purple-500" />
            </div>
            <p className="text-[11px] text-slate-500">Pending BA input</p>
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

        {/* Requirement Coverage Heatmap Matrix */}
        <div className="mt-6 p-5 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Per-Requirement Coverage Matrix
            </h4>
            <span className="text-[11px] text-slate-400">
              Positive • Negative • Boundary
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 pt-2">
            {Object.entries(reqCoverage).map(([rid, cov]) => (
              <div
                key={rid}
                onClick={() => onFilterGrid("requirement", rid)}
                className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/60 hover:border-indigo-300 hover:bg-white transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-slate-800">{rid}</span>
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
