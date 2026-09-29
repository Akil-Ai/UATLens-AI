"use client";

import React, { useState } from "react";
import {
  Users,
  ShieldAlert,
  Sliders,
  GitBranch,
  Layers,
  FileCheck,
  AlertCircle,
  Play,
  Plus,
  Trash2,
  Edit2,
  Check,
  HelpCircle,
  ChevronRight,
  ArrowRight,
} from "lucide-react";
import { ExtractedContextData } from "@/types";

interface Stage2ContextProps {
  contextData: ExtractedContextData;
  onContextDataChange: (newData: ExtractedContextData) => void;
  onProceedToGenerate: () => void;
  onBackToInput: () => void;
  isGenerating: boolean;
}

type TabKey = "roles" | "rules" | "conditions" | "states" | "dependencies" | "requirements" | "ambiguities";

export const Stage2Context: React.FC<Stage2ContextProps> = ({
  contextData,
  onContextDataChange,
  onProceedToGenerate,
  onBackToInput,
  isGenerating,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>("roles");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Tab definitions
  const tabs = [
    { key: "roles" as TabKey, label: "Roles", count: contextData.roles.length, icon: Users },
    { key: "rules" as TabKey, label: "Business Rules", count: contextData.business_rules.length, icon: FileCheck },
    { key: "conditions" as TabKey, label: "Conditions", count: contextData.conditions.length, icon: Sliders },
    { key: "states" as TabKey, label: "State Transitions", count: contextData.state_changes.length, icon: GitBranch },
    { key: "dependencies" as TabKey, label: "Dependencies", count: contextData.dependencies.length, icon: Layers },
    { key: "requirements" as TabKey, label: "Requirements", count: contextData.requirements.length, icon: Check },
    { key: "ambiguities" as TabKey, label: "Ambiguities", count: contextData.ambiguities.length, icon: AlertCircle, badgeColor: "bg-amber-100 text-amber-800" },
  ];

  // Handlers for deleting items
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

  // Add handlers
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
              Verify and edit the extracted roles, rules, conditions, and identified ambiguities before initiating test generation.
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
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Tab Content Panels */}
        <div className="mt-6">
          {/* 1. ROLES TAB */}
          {activeTab === "roles" && (
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

          {/* 7. AMBIGUITIES TAB (Highlighted in Amber with suggested BA questions) */}
          {activeTab === "ambiguities" && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>
                  The AI detected potential ambiguities, vague phrases, or unconstrained roles in the requirements. Review suggested clarification questions below.
                </span>
              </div>

              {contextData.ambiguities.map((amb, idx) => (
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
            </div>
          )}
        </div>

        {/* Footer Proceed Button */}
        <div className="mt-8 pt-6 border-t border-slate-200/60 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {contextData.business_rules.length} rules and {contextData.roles.length} roles verified.
          </span>
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

# Commit ref: 67
