"use client";

import React from "react";
import Link from "next/link";
import {
  FileText,
  Cpu,
  ShieldCheck,
  BarChart3,
  Download,
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  Layers,
} from "lucide-react";
import { BackgroundOrbs } from "@/components/layout/BackgroundOrbs";

const PIPELINE_STEPS = [
  {
    step: 1,
    title: "Upload or Paste Requirements",
    description:
      "Provide your business requirements via direct text input, file upload (PDF, DOCX, TXT, Markdown), or use the built-in sample e-commerce checkout specification. The parser automatically preserves headings, tables, and document structure.",
    icon: FileText,
    color: "from-indigo-600 to-indigo-500",
    detail: "Supported formats: .pdf, .docx, .txt, .md — tables and headings are extracted with full fidelity.",
  },
  {
    step: 2,
    title: "AI Context Extraction & Human Review",
    description:
      "The AI analyzes the document and extracts structured context: Roles, Business Rules, Conditions, State Transitions, Dependencies, Requirements, and Ambiguities. You review, edit, add, or remove any extracted item before proceeding.",
    icon: Cpu,
    color: "from-violet-600 to-purple-500",
    detail: "Human-in-the-loop checkpoint: the AI suggests, you verify. Ambiguities surface BA-ready clarification questions.",
  },
  {
    step: 3,
    title: "Test Case Generation & Inline Editing",
    description:
      "AI generates comprehensive UAT test cases covering Positive, Negative, and Boundary scenarios. Each case includes ID, steps, test data, expected results, and source traceability. Edit inline, regenerate individual fields, undo changes, and use bulk actions.",
    icon: ShieldCheck,
    color: "from-emerald-600 to-teal-500",
    detail: "Real-time streaming via SSE. Deterministic validation flags ambiguous requirements and vague terms.",
  },
  {
    step: 4,
    title: "Analytics Dashboard",
    description:
      "Visual analytics with interactive Recharts: Scenario Type distribution (donut), Priority breakdown (bar), Role allocation, and a per-Requirement coverage matrix. Click any chart segment to filter the test case grid directly.",
    icon: BarChart3,
    color: "from-amber-500 to-orange-500",
    detail: "Coverage gaps (missing Negative or Boundary scenarios) are highlighted automatically.",
  },
  {
    step: 5,
    title: "Multi-Format Export",
    description:
      "Download your validated test suite in Professional Excel (.xlsx) with 4 structured sheets, Standard CSV, Jira/TestRail-ready import format, or full Structured JSON for CI/CD automation pipelines.",
    icon: Download,
    color: "from-sky-600 to-cyan-500",
    detail: "Excel includes frozen headers, auto-filters, dropdown validation, Summary metrics, Clarifications queue, and Traceability matrix.",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 py-12">
        {/* Back Button */}
        <Link
          href="/"
          className="inline-flex items-center space-x-2 text-xs font-semibold text-slate-600 hover:text-indigo-600 transition-colors mb-8"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to UATlens AI</span>
        </Link>

        {/* Title Card */}
        <div className="glass-card p-8 rounded-3xl mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">
                How UATlens AI Works
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                From raw requirements to production-ready test suites in 5 stages.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 mt-6">
            <div className="p-4 rounded-2xl bg-indigo-50/80 border border-indigo-100 text-center">
              <Sparkles className="w-5 h-5 text-indigo-600 mx-auto mb-1" />
              <p className="text-xs font-bold text-indigo-900">AI Drafts</p>
              <p className="text-[11px] text-indigo-600">
                Structured generation with traceability
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-100 text-center">
              <ShieldCheck className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
              <p className="text-xs font-bold text-emerald-900">System Validates</p>
              <p className="text-[11px] text-emerald-600">
                Deterministic quality engine
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-100 text-center">
              <CheckCircle2 className="w-5 h-5 text-purple-600 mx-auto mb-1" />
              <p className="text-xs font-bold text-purple-900">Human Approves</p>
              <p className="text-[11px] text-purple-600">
                Full control at every checkpoint
              </p>
            </div>
          </div>
        </div>

        {/* Pipeline Steps */}
        <div className="space-y-6">
          {PIPELINE_STEPS.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.step}
                className="glass-card p-6 rounded-3xl glass-card-hover"
              >
                <div className="flex items-start space-x-4">
                  <div
                    className={`w-14 h-14 rounded-2xl bg-gradient-to-tr ${item.color} flex items-center justify-center text-white shadow-lg flex-shrink-0`}
                  >
                    <Icon className="w-7 h-7" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Stage {item.step}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {item.title}
                    </h3>
                    <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                      {item.description}
                    </p>
                    <div className="mt-3 p-3 rounded-xl bg-slate-50/80 border border-slate-200/60 text-xs text-slate-500 italic">
                      💡 {item.detail}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Validation Engine Section */}
        <div className="glass-card p-8 rounded-3xl mt-8">
          <h2 className="text-xl font-bold text-slate-900 mb-4 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <span>Quality Validation Engine</span>
          </h2>
          <p className="text-sm text-slate-600 mb-4">
            Every generated test case passes through a deterministic validation pipeline that checks:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              "Source quote traceability verification",
              "Vague language detection (e.g., 'quickly', 'properly')",
              "Missing boundary scenario coverage",
              "Incomplete preconditions or missing test data",
              "Business rule reference validation",
              "Clarification queue with BA-ready questions",
            ].map((check, idx) => (
              <div
                key={idx}
                className="flex items-center space-x-2 p-3 rounded-xl bg-white/80 border border-slate-200/60 text-xs text-slate-700"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                <span>{check}</span>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-10">
          <Link
            href="/"
            className="inline-flex items-center space-x-2 px-8 py-3 rounded-2xl text-sm font-bold text-white bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/25 transition-all"
          >
            <Sparkles className="w-4 h-4 text-indigo-200" />
            <span>Start Generating Test Cases</span>
          </Link>
        </div>
      </div>
    </div>
  );
}

# Commit ref: 89
