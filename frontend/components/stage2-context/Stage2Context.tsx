"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Users,
  ShieldAlert,
  Sliders,
  GitBranch,
  Layers,
  FileCheck,
  AlertCircle,
  Plus,
  Trash2,
  Check,
  ArrowRight,
  CheckCircle2,
  XCircle,
  MessageSquare,
  ShieldCheck,
  RefreshCw,
  Lock,
  Unlock,
} from "lucide-react";
import { ExtractedContextData, ClarificationDecision, PermissionRule } from "@/types";
import {
  syncClarificationDecisions,
  updateClarificationDecision,
  fetchClarificationDecisions,
  extractPermissionRules,
  fetchPermissionRules,
} from "@/lib/api";

interface Stage2ContextProps {
  contextData: ExtractedContextData;
  onContextDataChange: (newData: ExtractedContextData) => void;
  onProceedToGenerate: () => void;
  onBackToInput: () => void;
  isGenerating: boolean;
  projectId?: string;
}

type TabKey = "roles" | "rules" | "conditions" | "states" | "dependencies" | "requirements" | "ambiguities";

export const Stage2Context: React.FC<Stage2ContextProps> = ({
  contextData,
  onContextDataChange,
  onProceedToGenerate,
  onBackToInput,
  isGenerating,
  projectId,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("roles");

  // ── Clarification state ──
  const [clarifications, setClarifications] = useState<ClarificationDecision[]>([]);
  const [clarSyncing, setClarSyncing] = useState(false);
  const [answerDrafts, setAnswerDrafts] = useState<Record<string, string>>({});

  // ── Permission rule state ──
  const [permissionRules, setPermissionRules] = useState<PermissionRule[]>([]);
  const [permExtracting, setPermExtracting] = useState(false);

  // Load existing clarifications & permissions on mount
  useEffect(() => {
    if (!projectId) return;
    fetchClarificationDecisions(projectId).then((data) => {
      if (Array.isArray(data)) setClarifications(data);
    });
    fetchPermissionRules(projectId).then((data) => {
      if (Array.isArray(data)) setPermissionRules(data);
    });
  }, [projectId]);

  // ── Sync clarifications from ambiguities ──
  const handleSyncClarifications = useCallback(async () => {
    if (!projectId) return;
    setClarSyncing(true);
    try {
      const synced = await syncClarificationDecisions(projectId);
      setClarifications(synced);
    } catch (err) {
      console.error("Sync clarifications failed:", err);
    } finally {
      setClarSyncing(false);
    }
  }, [projectId]);

  // ── Update a single clarification decision ──
  const handleDecision = useCallback(
    async (decisionId: string, decision: "accepted" | "rejected" | "answered", answer?: string) => {
      if (!projectId) return;
      try {
        const updated = await updateClarificationDecision(projectId, decisionId, decision, answer);
        setClarifications((prev) => prev.map((d) => (d.id === decisionId ? updated : d)));
      } catch (err) {
        console.error("Update decision failed:", err);
      }
    },
    [projectId]
  );

  // ── Extract permission rules ──
  const handleExtractPermissions = useCallback(async () => {
    if (!projectId) return;
    setPermExtracting(true);
    try {
      const rules = await extractPermissionRules(projectId);
      setPermissionRules(rules);
    } catch (err) {
      console.error("Extract permissions failed:", err);
    } finally {
      setPermExtracting(false);
    }
  }, [projectId]);

  // Tab definitions
  const tabs = [
    { key: "roles" as TabKey, label: "Roles", count: contextData.roles.length, icon: Users },
    { key: "rules" as TabKey, label: "Business Rules", count: contextData.business_rules.length, icon: FileCheck },
    { key: "conditions" as TabKey, label: "Conditions", count: contextData.conditions.length, icon: Sliders },
    { key: "states" as TabKey, label: "State Transitions", count: contextData.state_changes.length, icon: GitBranch },
    { key: "dependencies" as TabKey, label: "Dependencies", count: contextData.dependencies.length, icon: Layers },
    { key: "requirements" as TabKey, label: "Requirements", count: contextData.requirements.length, icon: Check },
    {
      key: "ambiguities" as TabKey,
      label: "Clarifications",
      count: contextData.ambiguities.length,
      icon: AlertCircle,
      badgeColor: "bg-amber-100 text-amber-800",
    },
  ];

  const handleDeleteRole = (index: number) => {
    const updated = [...contextData.roles];
    updated.splice(index, 1);
    onContextDataChange({ ...contextData, roles: updated });
  };

  const handleDeleteRule = (index: number) => {
    const updated = [...contextData.business_rules];
    updated.splice(index, 1);
    onContextDataChange({ ...contextData, business_rules: updated });
  };

  const handleDeleteAmbiguity = (index: number) => {
    const updated = [...contextData.ambiguities];
    updated.splice(index, 1);
    onContextDataChange({ ...contextData, ambiguities: updated });
  };

  const handleAddRule = () => {
    const newId = `BR-${String(contextData.business_rules.length + 1).padStart(3, "0")}`;
    const newRule = {
      id: newId,
      text: "New business rule description",
      source_quote: "Excerpt from requirements",
      category: "General",
    };
    onContextDataChange({
      ...contextData,
      business_rules: [...contextData.business_rules, newRule],
    });
  };

  // Decision badge helper
  const decisionBadge = (decision: string) => {
    switch (decision) {
      case "accepted":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">Accepted</span>;
      case "rejected":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800">Rejected</span>;
      case "answered":
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-800">Answered</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800">Pending</span>;
    }
  };

  const allowRules = permissionRules.filter((r) => r.decision === "allow");
  const denyRules = permissionRules.filter((r) => r.decision === "deny");
  const pendingClarifications = clarifications.filter((c) => c.decision === "pending").length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Header Card */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold mb-2">
              <span>Stage 2 of 5</span>
              <span>•</span>
              <span>Human-in-the-Loop Checkpoint</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Extracted Context & Ambiguities Review
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Verify roles, rules, conditions, resolve ambiguities, and review permission analysis before generating tests.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToInput}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-600 hover:text-slate-800 border border-slate-200 shadow-xs transition-colors"
            >
              Back to Input
            </button>
            <button
              onClick={onProceedToGenerate}
              disabled={isGenerating}
              className="px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 shadow-md shadow-indigo-500/25 flex items-center space-x-2 transition-all"
            >
              <span>Generate Test Cases</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center space-x-2 overflow-x-auto py-4 border-b border-slate-200/60">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const showAlert = tab.key === "ambiguities" && pendingClarifications > 0;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  isActive
                    ? "bg-indigo-600 text-white shadow-sm shadow-indigo-600/25"
                    : "text-slate-600 hover:bg-white/80"
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? "text-white" : "text-slate-500"}`} />
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                    isActive ? "bg-white/20 text-white" : showAlert ? "bg-amber-400 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="mt-6">

          {/* 1. ROLES TAB — with Permission Matrix */}
          {activeTab === "roles" && (
            <div className="space-y-6">
              {/* Role Cards */}
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span>Identified Operational User Roles</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {contextData.roles.map((role, idx) => (
                    <div key={idx} className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-xs">
                            {role.name.charAt(0)}
                          </div>
                          <h4 className="font-bold text-sm text-slate-900">{role.name}</h4>
                        </div>
                        <button
                          onClick={() => handleDeleteRole(idx)}
                          className="text-slate-400 hover:text-rose-600 transition-colors"
                          title="Delete Role"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">{role.description}</p>
                      <div className="pt-2">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Permissions:</span>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {role.permissions.map((perm, pIdx) => (
                            <span
                              key={pIdx}
                              className="px-2 py-0.5 rounded-md bg-indigo-50/80 text-indigo-700 text-[10px] font-medium border border-indigo-100"
                            >
                              {perm}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Permission Analysis Matrix */}
              <div className="mt-4 p-5 rounded-2xl bg-white/80 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <ShieldCheck className="w-4 h-4 text-indigo-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Permission Analysis Matrix
                    </h4>
                    <span className="text-[10px] text-slate-400">
                      ({allowRules.length} allow · {denyRules.length} deny)
                    </span>
                  </div>
                  <button
                    onClick={handleExtractPermissions}
                    disabled={permExtracting || !projectId}
                    className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${permExtracting ? "animate-spin" : ""}`} />
                    <span>{permExtracting ? "Extracting..." : "Extract Permissions"}</span>
                  </button>
                </div>

                {permissionRules.length === 0 ? (
                  <div className="text-xs text-slate-400 italic text-center py-4">
                    Click "Extract Permissions" to derive role/action permission rules from the context.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* Group by role */}
                    {Array.from(new Set(permissionRules.map((r) => r.role))).map((role) => {
                      const roleRules = permissionRules.filter((r) => r.role === role);
                      const allows = roleRules.filter((r) => r.decision === "allow");
                      const denies = roleRules.filter((r) => r.decision === "deny");
                      return (
                        <div key={role} className="p-3 rounded-xl bg-slate-50/90 border border-slate-200/60 space-y-2">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 rounded-md bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-[10px]">
                              {role.charAt(0)}
                            </div>
                            <span className="text-xs font-bold text-slate-800">{role}</span>
                            <span className="text-[10px] text-slate-400">
                              {allows.length} allowed · {denies.length} denied
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {allows.map((r) => (
                              <span
                                key={r.id}
                                className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 text-[10px] font-medium border border-emerald-200"
                                title={r.condition || ""}
                              >
                                <Unlock className="w-2.5 h-2.5" />
                                <span>{r.action}</span>
                              </span>
                            ))}
                            {denies.map((r) => (
                              <span
                                key={r.id}
                                className="flex items-center space-x-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-800 text-[10px] font-medium border border-rose-200"
                                title={r.condition || ""}
                              >
                                <Lock className="w-2.5 h-2.5" />
                                <span>{r.action.replace("(restricted) ", "").slice(0, 60)}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 2. BUSINESS RULES TAB */}
          {activeTab === "rules" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>Extracted Business Rules with Source Justification</span>
                <button
                  onClick={handleAddRule}
                  className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Rule</span>
                </button>
              </div>
              {contextData.business_rules.map((rule, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 shadow-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-indigo-100 font-mono text-[11px] font-bold text-indigo-800">
                        {rule.id}
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{rule.category}</span>
                    </div>
                    <button
                      onClick={() => handleDeleteRule(idx)}
                      className="text-slate-400 hover:text-rose-600 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-800">{rule.text}</p>
                  <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-[11px] text-slate-600 italic">
                    &ldquo;{rule.source_quote}&rdquo;
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 3. CONDITIONS TAB */}
          {activeTab === "conditions" && (
            <div className="space-y-3">
              {contextData.conditions.map((cond, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/80 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {cond.id}
                    </span>
                    <p className="font-medium text-slate-800">{cond.text}</p>
                  </div>
                  <span className="text-[11px] text-slate-500 px-2 py-1 rounded-md bg-slate-100">
                    Applies: {cond.applies_to}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 4. STATE TRANSITIONS TAB */}
          {activeTab === "states" && (
            <div className="space-y-3">
              {contextData.state_changes.map((state, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/80 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <span className="font-bold text-slate-800">{state.entity}</span>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded bg-slate-100 font-mono text-[11px]">{state.from_state}</span>
                      <ArrowRight className="w-3 h-3 text-slate-400" />
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-mono text-[11px] font-semibold">
                        {state.to_state}
                      </span>
                    </div>
                  </div>
                  <span className="text-[11px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md font-medium">
                    Trigger: {state.trigger}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 5. DEPENDENCIES TAB */}
          {activeTab === "dependencies" && (
            <div className="space-y-3">
              {contextData.dependencies.map((dep, idx) => (
                <div key={idx} className="p-3.5 rounded-xl bg-white/80 border border-slate-200/80 flex items-center justify-between text-xs">
                  <div className="space-y-0.5">
                    <span className="font-mono text-[10px] font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">{dep.id}</span>
                    <p className="font-medium text-slate-800">{dep.description}</p>
                  </div>
                  <span className="text-[11px] text-purple-700 bg-purple-50 px-2 py-1 rounded-md font-medium">
                    Depends on: {dep.depends_on}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* 6. REQUIREMENTS TAB */}
          {activeTab === "requirements" && (
            <div className="space-y-3">
              {contextData.requirements.map((req, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-white/80 border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2 py-0.5 rounded-md bg-indigo-600 font-mono text-[11px] font-bold text-white">
                      {req.id}
                    </span>
                    <div className="flex gap-1.5">
                      {req.roles_involved.map((r, rIdx) => (
                        <span key={rIdx} className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[10px] font-semibold">
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                  <h4 className="text-xs font-bold text-slate-900">{req.title}</h4>
                  <p className="text-xs text-slate-600">{req.text}</p>
                  <p className="text-[11px] text-emerald-700 bg-emerald-50/80 p-2 rounded-lg font-medium">
                    Expected Outcome: {req.expected_outcome}
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* 7. CLARIFICATIONS TAB (enhanced from Ambiguities) */}
          {activeTab === "ambiguities" && (
            <div className="space-y-4">
              {/* Header banner */}
              <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold">Requirement Clarification Workflow</p>
                  <p>
                    Review detected ambiguities. Accept, reject, or provide a BA answer for each item.
                    Answered clarifications will be passed to the AI during test generation to produce more accurate tests.
                  </p>
                </div>
              </div>

              {/* Sync button */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  {clarifications.length > 0
                    ? `${clarifications.filter(c => c.decision !== "pending").length} of ${clarifications.length} resolved`
                    : "No decisions synced yet"}
                </span>
                <button
                  onClick={handleSyncClarifications}
                  disabled={clarSyncing || !projectId}
                  className="flex items-center space-x-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${clarSyncing ? "animate-spin" : ""}`} />
                  <span>{clarSyncing ? "Syncing..." : "Sync Clarifications"}</span>
                </button>
              </div>

              {/* Fallback: show raw ambiguities if no synced decisions */}
              {clarifications.length === 0 && contextData.ambiguities.map((amb, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-amber-50/40 border border-amber-200/80 shadow-xs space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 font-mono text-[11px] font-bold text-amber-900">
                        {amb.requirement_id || "GENERAL"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-800">
                        {amb.issue_type}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteAmbiguity(idx)}
                      className="text-amber-500 hover:text-amber-800 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-xs font-medium text-slate-800">{amb.description}</p>
                  <div className="p-3 rounded-xl bg-white/90 border border-amber-200 text-xs space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Suggested BA Clarification Question:
                    </span>
                    <p className="font-semibold text-slate-800">&ldquo;{amb.suggested_question}&rdquo;</p>
                  </div>
                </div>
              ))}

              {/* Synced clarification decisions with decision controls */}
              {clarifications.map((clar) => (
                <div
                  key={clar.id}
                  className={`p-4 rounded-2xl border shadow-xs space-y-3 ${
                    clar.decision === "answered"
                      ? "bg-indigo-50/40 border-indigo-200/80"
                      : clar.decision === "accepted"
                      ? "bg-emerald-50/40 border-emerald-200/80"
                      : clar.decision === "rejected"
                      ? "bg-slate-50/60 border-slate-200"
                      : "bg-amber-50/40 border-amber-200/80"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 flex-wrap gap-1">
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 font-mono text-[11px] font-bold text-amber-900">
                        {clar.requirement_id || "GENERAL"}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-800">
                        {clar.issue_type}
                      </span>
                      {decisionBadge(clar.decision)}
                    </div>
                  </div>

                  <p className="text-xs font-medium text-slate-800">{clar.description}</p>

                  <div className="p-3 rounded-xl bg-white/90 border border-amber-100 text-xs">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700">
                      Suggested BA Question:
                    </span>
                    <p className="font-semibold text-slate-800 mt-0.5">&ldquo;{clar.suggested_question}&rdquo;</p>
                  </div>

                  {/* Decision actions */}
                  {clar.decision === "pending" && (
                    <div className="flex items-center space-x-2 pt-1">
                      <button
                        onClick={() => handleDecision(clar.id, "accepted")}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-semibold hover:bg-emerald-200 transition-colors"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Accept As-Is</span>
                      </button>
                      <button
                        onClick={() => handleDecision(clar.id, "rejected")}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-xs font-semibold hover:bg-slate-200 transition-colors"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        <span>Not Applicable</span>
                      </button>
                      <button
                        onClick={() => {
                          setAnswerDrafts((prev) => ({ ...prev, [clar.id]: "" }));
                        }}
                        className="flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-100 text-indigo-800 text-xs font-semibold hover:bg-indigo-200 transition-colors"
                      >
                        <MessageSquare className="w-3.5 h-3.5" />
                        <span>Provide Answer</span>
                      </button>
                    </div>
                  )}

                  {/* Answer input */}
                  {(clar.id in answerDrafts || clar.decision === "answered") && (
                    <div className="space-y-2">
                      <textarea
                        rows={2}
                        value={answerDrafts[clar.id] ?? clar.reviewer_answer ?? ""}
                        onChange={(e) =>
                          setAnswerDrafts((prev) => ({ ...prev, [clar.id]: e.target.value }))
                        }
                        placeholder="Type your clarification answer here..."
                        className="w-full px-3 py-2 rounded-xl text-xs border border-indigo-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300 resize-none"
                      />
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => {
                            const answer = answerDrafts[clar.id] ?? "";
                            if (answer.trim()) {
                              handleDecision(clar.id, "answered", answer);
                              setAnswerDrafts((prev) => {
                                const next = { ...prev };
                                delete next[clar.id];
                                return next;
                              });
                            }
                          }}
                          className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors"
                        >
                          Save Answer
                        </button>
                        <button
                          onClick={() =>
                            setAnswerDrafts((prev) => {
                              const next = { ...prev };
                              delete next[clar.id];
                              return next;
                            })
                          }
                          className="px-3 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Show saved answer */}
                  {clar.decision === "answered" && clar.reviewer_answer && !(clar.id in answerDrafts) && (
                    <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-xs">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-600">BA Answer:</span>
                      <p className="text-slate-800 mt-0.5 font-medium">{clar.reviewer_answer}</p>
                      <button
                        onClick={() =>
                          setAnswerDrafts((prev) => ({
                            ...prev,
                            [clar.id]: clar.reviewer_answer || "",
                          }))
                        }
                        className="text-indigo-600 text-[10px] font-semibold hover:underline mt-1"
                      >
                        Edit answer
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-8 pt-6 border-t border-slate-200/60 flex items-center justify-between">
          <div className="text-xs text-slate-500 space-y-0.5">
            <p>{contextData.business_rules.length} rules and {contextData.roles.length} roles verified.</p>
            {clarifications.length > 0 && (
              <p className={pendingClarifications > 0 ? "text-amber-600 font-medium" : "text-emerald-600 font-medium"}>
                {pendingClarifications > 0
                  ? `${pendingClarifications} clarification(s) still pending — answers will improve test quality.`
                  : "All clarifications resolved ✓"}
              </p>
            )}
          </div>
          <button
            onClick={onProceedToGenerate}
            disabled={isGenerating}
            className="px-7 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all flex items-center space-x-2"
          >
            <span>Proceed to Test Case Generation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
