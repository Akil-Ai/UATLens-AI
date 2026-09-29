"use client";

import React, { useState, useMemo } from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  RotateCcw,
  CheckCircle,
  Trash2,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  Info,
  Layers,
  Copy,
  Check,
  Edit3,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { TestCase, ScenarioType, PriorityType, TestCaseStatus, FlagItem } from "@/types";
import { Badge } from "@/components/glass/Badge";
import { updateTestCase, undoTestCase, regenerateField, deleteTestCase, bulkUpdateTestCases } from "@/lib/api";

interface Stage3GridProps {
  projectId: string;
  testCases: TestCase[];
  onTestCasesChange: (cases: TestCase[]) => void;
  isStreaming: boolean;
  streamProgress: { completed: number; total: number; message: string };
  onCancelStream?: () => void;
  onProceedToDashboard: () => void;
  rawDocumentText: string;
}

export const Stage3Grid: React.FC<Stage3GridProps> = ({
  projectId,
  testCases,
  onTestCasesChange,
  isStreaming,
  streamProgress,
  onCancelStream,
  onProceedToDashboard,
  rawDocumentText,
}) => {
  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("All");
  const [selectedType, setSelectedType] = useState<string>("All");
  const [selectedPriority, setSelectedPriority] = useState<string>("All");
  const [selectedStatus, setSelectedStatus] = useState<string>("All");

  // Selection states
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Inline editing state
  const [editingCell, setEditingCell] = useState<{ id: string; field: string } | null>(null);
  const [editValue, setEditValue] = useState<string>("");

  // Row loading states for individual row regeneration
  const [rowRegeneratingId, setRowRegeneratingId] = useState<string | null>(null);
  const [regenerateInstruction, setRegenerateInstruction] = useState<string>("");
  const [instructionPopoverCaseId, setInstructionPopoverCaseId] = useState<string | null>(null);

  // Traceability drawer
  const [activeTraceReqId, setActiveTraceReqId] = useState<string | null>(null);

  // Clarification Queue drawer
  const [clarificationDrawerOpen, setClarificationDrawerOpen] = useState(false);
  const [copiedQuestions, setCopiedQuestions] = useState(false);

  // Extract unique roles for dropdown
  const uniqueRoles = useMemo(() => {
    const roles = new Set(testCases.map((tc) => tc.role));
    return ["All", ...Array.from(roles)];
  }, [testCases]);

  // Filtered test cases
  const filteredCases = useMemo(() => {
    return testCases.filter((tc) => {
      if (selectedRole !== "All" && tc.role.toLowerCase() !== selectedRole.toLowerCase()) return false;
      if (selectedType !== "All" && tc.scenario_type !== selectedType) return false;
      if (selectedPriority !== "All" && tc.priority !== selectedPriority) return false;
      if (selectedStatus !== "All" && tc.status !== selectedStatus) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${tc.id} ${tc.scenario} ${tc.expected_result} ${tc.role} ${tc.steps.join(" ")}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [testCases, selectedRole, selectedType, selectedPriority, selectedStatus, searchQuery]);

  // Total flags across suite
  const totalFlags = useMemo(() => {
    return testCases.reduce((sum, tc) => sum + (tc.flags ? tc.flags.length : 0), 0);
  }, [testCases]);

  // Handle cell edit save
  const handleSaveCell = async (tc: TestCase, field: string) => {
    setEditingCell(null);
    const updated = testCases.map((item) => {
      if (item.id === tc.id) {
        if (field === "scenario") return { ...item, scenario: editValue };
        if (field === "expected_result") return { ...item, expected_result: editValue };
      }
      return item;
    });
    onTestCasesChange(updated);

    try {
      await updateTestCase(tc.id, projectId, { [field]: editValue });
    } catch (err) {
      console.error("Failed to autosave edit", err);
    }
  };

  // Quick field updates (dropdowns)
  const handleQuickUpdate = async (tcId: string, updates: Partial<TestCase>) => {
    const updated = testCases.map((tc) => (tc.id === tcId ? { ...tc, ...updates } : tc));
    onTestCasesChange(updated);
    try {
      await updateTestCase(tcId, projectId, updates);
    } catch (err) {
      console.error("Quick update failed", err);
    }
  };

  // Regenerate row field (Expected Result, Steps, or Row)
  const handleRegenerate = async (tc: TestCase, targetField: "expected_result" | "steps" | "entire_row") => {
    setRowRegeneratingId(tc.id);
    setInstructionPopoverCaseId(null);
    try {
      const res = await regenerateField(projectId, tc.id, targetField, regenerateInstruction);
      const updated = testCases.map((item) => {
        if (item.id === tc.id) {
          return {
            ...item,
            expected_result: res.expected_result || item.expected_result,
            steps: res.steps || item.steps,
            scenario: res.scenario || item.scenario,
          };
        }
        return item;
      });
      onTestCasesChange(updated);
      setRegenerateInstruction("");
    } catch (err) {
      console.error("Regenerate failed", err);
    } finally {
      setRowRegeneratingId(null);
    }
  };

  // Undo row to previous version
  const handleUndo = async (tcId: string) => {
    try {
      await undoTestCase(tcId, projectId);
      // Reload fresh list or revert in local
      const res = await fetch(`/api/test-cases?project_id=${projectId}`);
      if (res.ok) {
        const fresh = await res.json();
        onTestCasesChange(fresh);
      }
    } catch (err) {
      alert("No previous versions available to undo.");
    }
  };

  // Delete row
  const handleDeleteRow = async (tcId: string) => {
    if (!confirm(`Are you sure you want to delete ${tcId}?`)) return;
    try {
      await deleteTestCase(tcId, projectId);
      onTestCasesChange(testCases.filter((tc) => tc.id !== tcId));
    } catch (err) {
      console.error("Delete failed", err);
    }
  };

  // Bulk actions
  const handleBulkAction = async (action: string, value?: string) => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await bulkUpdateTestCases(projectId, ids, action, value);
      if (action === "delete") {
        onTestCasesChange(testCases.filter((tc) => !selectedIds.has(tc.id)));
        setSelectedIds(new Set());
      } else if (action === "approve") {
        onTestCasesChange(
          testCases.map((tc) => (selectedIds.has(tc.id) ? { ...tc, status: "Approved" } : tc))
        );
      }
    } catch (err) {
      console.error("Bulk action failed", err);
    }
  };

  // Copy BA questions from Clarification Queue
  const handleCopyBAQuestions = () => {
    const questions: string[] = [];
    testCases.forEach((tc) => {
      tc.flags?.forEach((f) => {
        if (f.suggested_question) {
          questions.push(`[${tc.id} - ${tc.requirement_id || "REQ"}] ${f.type}: ${f.suggested_question}`);
        }
      });
    });
    navigator.clipboard.writeText(questions.join("\n\n"));
    setCopiedQuestions(true);
    setTimeout(() => setCopiedQuestions(false), 2500);
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6">
      {/* Streaming Progress Bar Banner */}
      {isStreaming && (
        <div className="glass-card p-4 rounded-2xl bg-indigo-50/90 border border-indigo-200/90 shadow-sm animate-pulse-subtle">
          <div className="flex items-center justify-between text-xs font-semibold text-indigo-900 mb-2">
            <div className="flex items-center space-x-2">
              <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
              <span>{streamProgress.message || "Generating test cases..."}</span>
            </div>
            <div className="flex items-center space-x-3">
              <span className="font-mono text-indigo-700 font-bold">
                {testCases.length} generated
              </span>
              {onCancelStream && (
                <button
                  onClick={onCancelStream}
                  className="px-2.5 py-1 rounded-lg bg-white text-slate-700 hover:bg-slate-100 text-[11px] font-semibold border border-slate-200"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
          <div className="w-full h-2 rounded-full bg-indigo-200/60 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-indigo-500 via-indigo-600 to-purple-600 transition-all duration-300"
              style={{
                width: `${Math.min(100, Math.max(15, (testCases.length / 25) * 100))}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Main Glass Grid Card */}
      <div className="glass-card p-6 rounded-3xl space-y-5">
        {/* Top Control Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200/60">
          <div>
            <div className="flex items-center space-x-3">
              <h2 className="text-xl font-bold tracking-tight text-slate-900">
                User Acceptance Test Cases
              </h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                {filteredCases.length} of {testCases.length} Cases
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Inline-editable data grid. AI regenerates expected results while respecting human edits.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Clarification Queue trigger */}
            <button
              onClick={() => setClarificationDrawerOpen(true)}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-xs transition-colors"
            >
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
              <span>Clarification Queue ({totalFlags})</span>
            </button>

            {/* Proceed to Dashboard */}
            <button
              onClick={onProceedToDashboard}
              className="flex items-center space-x-2 px-5 py-2 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-sm shadow-indigo-500/25 transition-all"
            >
              <span>View Analytics</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 pt-1">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search scenarios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs glass-input text-slate-800 placeholder-slate-400"
            />
          </div>

          {/* Role Filter */}
          <div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value)}
              className="w-full px-3 py-2 text-xs glass-input text-slate-800"
            >
              <option value="All">All Roles</option>
              {uniqueRoles
                .filter((r) => r !== "All")
                .map((r) => (
                  <option key={r} value={r}>
                    Role: {r}
                  </option>
                ))}
            </select>
          </div>

          {/* Scenario Type Filter */}
          <div>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full px-3 py-2 text-xs glass-input text-slate-800"
            >
              <option value="All">All Types</option>
              <option value="Positive">● Positive</option>
              <option value="Negative">▲ Negative</option>
              <option value="Boundary">◆ Boundary</option>
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value)}
              className="w-full px-3 py-2 text-xs glass-input text-slate-800"
            >
              <option value="All">All Priorities</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full px-3 py-2 text-xs glass-input text-slate-800"
            >
              <option value="All">All Statuses</option>
              <option value="Approved">Approved</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Draft">Draft</option>
              <option value="Needs Clarification">Needs Clarification</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Toolbar */}
        {selectedIds.size > 0 && (
          <div className="p-3 rounded-2xl bg-indigo-50/90 border border-indigo-200/80 flex items-center justify-between text-xs animate-in fade-in">
            <span className="font-semibold text-indigo-950">
              {selectedIds.size} cases selected
            </span>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction("approve")}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-medium hover:bg-emerald-500 shadow-xs"
              >
                Approve Selected
              </button>
              <button
                onClick={() => handleBulkAction("delete")}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-medium hover:bg-rose-500 shadow-xs"
              >
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-2.5 py-1.5 rounded-lg text-slate-600 hover:bg-slate-200/60"
              >
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Table Container */}
        <div className="overflow-x-auto rounded-2xl border border-slate-200/80 shadow-xs bg-white/70">
          <table className="w-full text-left border-collapse">
            {/* Sticky Glass Table Header */}
            <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-md text-[11px] font-bold uppercase tracking-wider text-slate-600 border-b border-slate-200">
              <tr>
                <th className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === filteredCases.length && filteredCases.length > 0}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(new Set(filteredCases.map((c) => c.id)));
                      } else {
                        setSelectedIds(new Set());
                      }
                    }}
                    className="rounded text-indigo-600"
                  />
                </th>
                <th className="p-3 w-20">ID</th>
                <th className="p-3 w-48">Scenario</th>
                <th className="p-3 w-28">Type</th>
                <th className="p-3 w-28">Role</th>
                <th className="p-3 w-24">Priority</th>
                <th className="p-3 min-w-[280px]">Steps</th>
                <th className="p-3 min-w-[240px]">Expected Result</th>
                <th className="p-3 w-28">Status</th>
                <th className="p-3 w-28 text-right">Actions</th>
              </tr>
            </thead>

            {/* Table Body */}
            <tbody className="divide-y divide-slate-100 text-xs">
              {filteredCases.length === 0 ? (
                <tr>
                  <td colSpan={10} className="p-10 text-center text-slate-400">
                    No test cases match the active search or filters.
                  </td>
                </tr>
              ) : (
                filteredCases.map((tc) => {
                  const isSelected = selectedIds.has(tc.id);
                  const isRegenerating = rowRegeneratingId === tc.id;
                  const hasFlags = tc.flags && tc.flags.length > 0;

                  return (
                    <tr
                      key={tc.id}
                      className={`hover:bg-indigo-50/30 transition-colors ${
                        isSelected ? "bg-indigo-50/50" : ""
                      }`}
                    >
                      {/* Select Checkbox */}
                      <td className="p-3 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            const next = new Set(selectedIds);
                            if (e.target.checked) next.add(tc.id);
                            else next.delete(tc.id);
                            setSelectedIds(next);
                          }}
                          className="rounded text-indigo-600"
                        />
                      </td>

                      {/* ID with Traceability badge */}
                      <td className="p-3 font-mono font-bold text-slate-800">
                        <div className="space-y-1">
                          <span>{tc.id}</span>
                          {tc.requirement_id && (
                            <button
                              onClick={() => setActiveTraceReqId(tc.requirement_id || null)}
                              className="block text-[10px] text-indigo-600 hover:text-indigo-800 font-semibold underline decoration-indigo-300"
                              title="Click to view traceability to original requirement"
                            >
                              {tc.requirement_id}
                            </button>
                          )}
                          {hasFlags && (
                            <div className="flex flex-col gap-1 mt-1">
                              {tc.flags.map((f, i) => (
                                <span
                                  key={i}
                                  className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-800 border border-amber-200 cursor-help"
                                  title={`${f.message} \nBA Question: ${f.suggested_question || "None"}`}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-600" />
                                  <span className="truncate max-w-[90px]">{f.type}</span>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Scenario (Inline Editable) */}
                      <td className="p-3 text-slate-900 font-medium">
                        {editingCell?.id === tc.id && editingCell.field === "scenario" ? (
                          <div className="space-y-1.5">
                            <textarea
                              rows={2}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full p-2 text-xs glass-input font-medium"
                              autoFocus
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleSaveCell(tc, "scenario")}
                                className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCell(null)}
                                className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingCell({ id: tc.id, field: "scenario" });
                              setEditValue(tc.scenario);
                            }}
                            className="cursor-pointer group flex items-start justify-between"
                            title="Click to edit scenario"
                          >
                            <span>{tc.scenario}</span>
                            <Edit3 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 flex-shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* Scenario Type */}
                      <td className="p-3">
                        <Badge type={tc.scenario_type} />
                      </td>

                      {/* Role Pill */}
                      <td className="p-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                          {tc.role}
                        </span>
                      </td>

                      {/* Priority */}
                      <td className="p-3">
                        <Badge priority={tc.priority} />
                      </td>

                      {/* Steps */}
                      <td className="p-3 text-slate-700">
                        <ol className="list-decimal list-inside space-y-1 text-[11px] leading-relaxed">
                          {tc.steps.map((st, sIdx) => (
                            <li key={sIdx} className="text-slate-600">
                              {st.replace(/^\d+\.\s*/, "")}
                            </li>
                          ))}
                        </ol>
                        {tc.test_data && Object.keys(tc.test_data).length > 0 && (
                          <div className="mt-2 p-2 rounded-lg bg-slate-50 border border-slate-100 text-[10px] font-mono text-slate-600 space-y-0.5">
                            <span className="font-bold text-slate-400 block uppercase">Test Data:</span>
                            {Object.entries(tc.test_data).map(([k, v]) => (
                              <div key={k}>
                                <strong className="text-indigo-700">{k}:</strong> {String(v)}
                              </div>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Expected Result (Inline Editable + Row Spinner) */}
                      <td className="p-3 text-slate-800">
                        {isRegenerating ? (
                          <div className="flex items-center space-x-2 py-3 text-indigo-600 font-semibold text-xs animate-pulse">
                            <RefreshCw className="w-4 h-4 animate-spin text-indigo-600" />
                            <span>Regenerating expected result...</span>
                          </div>
                        ) : editingCell?.id === tc.id && editingCell.field === "expected_result" ? (
                          <div className="space-y-1.5">
                            <textarea
                              rows={3}
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="w-full p-2 text-xs glass-input"
                              autoFocus
                            />
                            <div className="flex space-x-1">
                              <button
                                onClick={() => handleSaveCell(tc, "expected_result")}
                                className="px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingCell(null)}
                                className="px-2 py-0.5 rounded bg-slate-200 text-slate-700 text-[10px]"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div
                            onClick={() => {
                              setEditingCell({ id: tc.id, field: "expected_result" });
                              setEditValue(tc.expected_result);
                            }}
                            className="cursor-pointer group flex items-start justify-between"
                            title="Click to edit expected result"
                          >
                            <span className="text-[11px] leading-relaxed">{tc.expected_result}</span>
                            <Edit3 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1.5 flex-shrink-0" />
                          </div>
                        )}
                      </td>

                      {/* Status */}
                      <td className="p-3">
                        <select
                          value={tc.status}
                          onChange={(e) => handleQuickUpdate(tc.id, { status: e.target.value as TestCaseStatus })}
                          className="text-[11px] font-semibold px-2 py-1 rounded-lg border border-slate-200 bg-white"
                        >
                          <option value="Draft">Draft</option>
                          <option value="Reviewed">Reviewed</option>
                          <option value="Approved">Approved</option>
                          <option value="Needs Clarification">Needs Clarification</option>
                        </select>
                      </td>

                      {/* Row Actions */}
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end space-x-1">
                          {/* Regenerate Expected Result */}
                          <button
                            disabled={isRegenerating}
                            onClick={() => handleRegenerate(tc, "expected_result")}
                            className="p-1.5 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                            title="Regenerate Expected Result"
                          >
                            <Sparkles className="w-3.5 h-3.5" />
                          </button>

                          {/* Undo */}
                          <button
                            onClick={() => handleUndo(tc.id)}
                            className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                            title="Undo previous edit"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => handleDeleteRow(tc.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                            title="Delete Row"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Traceability Drawer */}
      {activeTraceReqId && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl h-full shadow-2xl p-6 overflow-y-auto space-y-4 border-l border-slate-200">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-1 rounded-md bg-indigo-600 text-white font-mono text-xs font-bold">
                  {activeTraceReqId}
                </span>
                <h3 className="font-bold text-slate-900 text-sm">Requirement Traceability</h3>
              </div>
              <button
                onClick={() => setActiveTraceReqId(null)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Source Document Highlight
              </span>
              <div className="p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 text-xs text-slate-800 leading-relaxed font-sans max-h-72 overflow-y-auto">
                <p>{rawDocumentText || "Document text available in Project."}</p>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200 space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Linked Test Cases
              </span>
              {testCases
                .filter((tc) => tc.requirement_id === activeTraceReqId)
                .map((c) => (
                  <div key={c.id} className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-800">{c.id}: {c.scenario}</span>
                      <Badge type={c.scenario_type} />
                    </div>
                    <p className="text-[11px] text-slate-500 italic">&ldquo;{c.source_quote}&rdquo;</p>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* Clarification Queue Side Drawer */}
      {clarificationDrawerOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/30 backdrop-blur-xs flex justify-end animate-in fade-in">
          <div className="w-full max-w-lg bg-white/95 backdrop-blur-2xl h-full shadow-2xl p-6 overflow-y-auto space-y-4 border-l border-slate-200 flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-slate-200">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                <h3 className="font-bold text-slate-900 text-sm">Clarification Queue</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">
                  {totalFlags} Open Flags
                </span>
              </div>
              <button
                onClick={() => setClarificationDrawerOpen(false)}
                className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-slate-500">
              The quality validation engine has detected potential gaps or unquantified requirements. Copy questions directly for your Business Analyst.
            </p>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1">
              {testCases.map((tc) =>
                tc.flags?.map((f, idx) => (
                  <div key={`${tc.id}-${idx}`} className="p-3.5 rounded-2xl bg-amber-50/50 border border-amber-200/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-amber-900">{tc.id}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900">
                        {f.type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-700">{f.message}</p>
                    {f.suggested_question && (
                      <div className="p-2.5 rounded-xl bg-white/90 border border-amber-100 text-[11px] space-y-0.5">
                        <strong className="text-amber-800 block">Suggested Question for BA:</strong>
                        <p className="text-slate-700 italic">&ldquo;{f.suggested_question}&rdquo;</p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={handleCopyBAQuestions}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center space-x-2 shadow-sm shadow-indigo-600/25 transition-colors"
              >
                {copiedQuestions ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Copied All Questions to Clipboard!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Copy All Questions for BA</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

# Commit ref: 75
