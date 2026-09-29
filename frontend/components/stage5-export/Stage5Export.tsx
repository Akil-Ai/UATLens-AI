"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  FileCode,
  Download,
  CheckCircle,
  Clock,
  Layers,
  Sparkles,
  ArrowLeft,
  ExternalLink,
  AlertCircle,
  X,
} from "lucide-react";
import { TestCase } from "@/types";

interface Stage5ExportProps {
  projectId: string;
  projectName: string;
  testCases: TestCase[];
  onBackToDashboard: () => void;
}

type ExportStatus = { type: "success" | "error"; message: string } | null;

export const Stage5Export: React.FC<Stage5ExportProps> = ({
  projectId,
  projectName,
  testCases,
  onBackToDashboard,
}) => {
  const [exportScope, setExportScope] = useState<"all" | "approved">("all");
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>(null);

  const approvedCount = testCases.filter((tc) => tc.status === "Approved").length;

  const MIME_TYPES: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv",
    jira: "text/csv",
    json: "application/json",
  };

  const FILE_EXT: Record<string, string> = {
    xlsx: "xlsx",
    csv: "csv",
    jira: "csv",
    json: "json",
  };

  const handleDownload = async (format: "xlsx" | "csv" | "jira" | "json") => {
    if (!projectId) {
      setExportStatus({ type: "error", message: "No project selected. Please select a project before exporting." });
      return;
    }

    setDownloadingFormat(format);
    setExportStatus(null);

    try {
      const statusParam = exportScope === "approved" ? "&status=Approved" : "";
      const downloadUrl = `/api/export/${projectId}?format=${format}${statusParam}`;

      const response = await fetch(downloadUrl, { method: "GET" });

      if (!response.ok) {
        let detail = `Server returned ${response.status}`;
        try {
          const errJson = await response.json();
          detail = errJson?.detail || detail;
        } catch {}
        throw new Error(detail);
      }

      // Read binary content as blob
      const blob = await response.blob();

      // Extract filename from Content-Disposition header
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename[^;=\n]*=\s*["']?([^"';\n]+)["']?/i);
      const filename = match
        ? match[1].trim()
        : `${projectName || "UATlens"}_Export.${FILE_EXT[format]}`;

      // Create a temporary object URL and trigger download
      const blobUrl = URL.createObjectURL(
        new Blob([blob], { type: MIME_TYPES[format] })
      );
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Release memory
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

      setExportStatus({
        type: "success",
        message: `✓ "${filename}" downloaded successfully.`,
      });
    } catch (err: any) {
      console.error("Export download failed", err);
      setExportStatus({
        type: "error",
        message: err?.message || "Export failed. Please ensure test cases are generated and try again.",
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 800);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="glass-card p-6 sm:p-8 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-700 text-xs font-semibold mb-2">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Stage 5 of 5</span>
              <span>•</span>
              <span>Production Ready Export</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Export Test Suite
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              Download your verified test suite in enterprise-ready Excel, standard CSV, Jira/TestRail format, or programmatic JSON.
            </p>
          </div>

          <button
            onClick={onBackToDashboard}
            className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors self-start sm:self-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Dashboard</span>
          </button>
        </div>

        {/* Export Status Banner */}
        {exportStatus && (
          <div
            className={`mt-5 flex items-start justify-between gap-3 px-4 py-3 rounded-2xl text-xs font-medium border animate-in fade-in slide-in-from-top-1 duration-300 ${
              exportStatus.type === "success"
                ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-center space-x-2">
              {exportStatus.type === "success" ? (
                <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              )}
              <span>{exportStatus.message}</span>
            </div>
            <button
              onClick={() => setExportStatus(null)}
              className="p-0.5 rounded-full hover:bg-black/10 transition-colors shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Scope Selector: All vs Approved */}
        <div className="mt-6 p-4 rounded-2xl bg-indigo-50/60 border border-indigo-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
          <div>
            <span className="font-bold text-slate-900">Select Export Scope:</span>
            <p className="text-slate-500 text-[11px] mt-0.5">
              Choose whether to export the full generated suite or only human-approved test cases.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-white p-1 rounded-xl border border-slate-200">
            <button
              onClick={() => setExportScope("all")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                exportScope === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Export All ({testCases.length})
            </button>
            <button
              onClick={() => setExportScope("approved")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all ${
                exportScope === "approved"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Approved Only ({approvedCount})
            </button>
          </div>
        </div>

        {/* 4 Export Option Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          {/* 1. Formatted Excel .XLSX */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Professional Excel (.xlsx) Workbook
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                4 structured sheets: <strong>Test Cases</strong> (exact column order, frozen header, auto-filter, dropdown validation), <strong>Summary</strong> metrics, <strong>Clarifications</strong> queue, and <strong>Traceability</strong> matrix.
              </p>
            </div>
            <button
              disabled={downloadingFormat === "xlsx"}
              onClick={() => handleDownload("xlsx")}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingFormat === "xlsx" ? "Generating .xlsx..." : "Download Excel Workbook"}</span>
            </button>
          </div>

          {/* 2. Standard CSV */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-xs">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Standard Test Cases CSV
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Lightweight comma-separated format matching exact required columns: ID, Scenario, Preconditions, Steps, Test Data, Expected Result, Type, Role, Priority.
              </p>
            </div>
            <button
              disabled={downloadingFormat === "csv"}
              onClick={() => handleDownload("csv")}
              className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm shadow-sky-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingFormat === "csv" ? "Generating CSV..." : "Download Standard CSV"}</span>
            </button>
          </div>

          {/* 3. Jira / TestRail Ready CSV */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Jira / TestRail Import CSV
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pre-formatted for bulk issue creation with columns: Summary, Description, Preconditions, Steps, Expected Result, Priority, and categorized Labels.
              </p>
            </div>
            <button
              disabled={downloadingFormat === "jira"}
              onClick={() => handleDownload("jira")}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingFormat === "jira" ? "Exporting Jira CSV..." : "Download Jira / TestRail CSV"}</span>
            </button>
          </div>

          {/* 4. Structured JSON */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs">
                <FileCode className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Full Structured Suite (JSON)
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Complete schema-validated payload for CI/CD test automation pipelines, automated regression suites, or audit compliance repositories.
              </p>
            </div>
            <button
              disabled={downloadingFormat === "json"}
              onClick={() => handleDownload("json")}
              className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm shadow-purple-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>{downloadingFormat === "json" ? "Building JSON..." : "Download Structured JSON"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
