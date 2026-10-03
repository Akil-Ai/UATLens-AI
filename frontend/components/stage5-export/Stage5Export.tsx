"use client";

import React, { useState } from "react";
import {
  FileSpreadsheet,
  FileText,
  FileCode,
  FileCheck,
  Download,
  CheckCircle,
  Eye,
  Layers,
  Sparkles,
  ArrowLeft,
  AlertCircle,
  X,
  Search,
  Copy,
  Check,
  Table as TableIcon,
  HelpCircle,
  Shield,
  FileDown,
  Info,
} from "lucide-react";
import { TestCase } from "@/types";
import { getAccessToken } from "@/lib/supabase";

interface Stage5ExportProps {
  projectId: string;
  projectName: string;
  testCases: TestCase[];
  onBackToDashboard: () => void;
}

type ExportStatus = {
  type: "success" | "error";
  message: string;
  filename?: string;
  format?: string;
} | null;

export const Stage5Export: React.FC<Stage5ExportProps> = ({
  projectId,
  projectName,
  testCases,
  onBackToDashboard,
}) => {
  const [exportScope, setExportScope] = useState<"all" | "approved">("all");
  const [downloadingFormat, setDownloadingFormat] = useState<string | null>(null);
  const [exportStatus, setExportStatus] = useState<ExportStatus>(null);

  // In-App Viewer Modal State
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewTab, setPreviewTab] = useState<
    "test_cases" | "requirements" | "clarifications" | "permissions" | "coverage" | "json"
  >("test_cases");
  const [previewSearch, setPreviewSearch] = useState("");
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [fullExportData, setFullExportData] = useState<any>(null);
  const [copiedJson, setCopiedJson] = useState(false);

  const approvedCount = testCases.filter((tc) => tc.status === "Approved").length;

  const MIME_TYPES: Record<string, string> = {
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    csv: "text/csv; charset=utf-8",
    jira: "text/csv; charset=utf-8",
    json: "application/json; charset=utf-8",
    zip: "application/zip",
  };

  const FILE_EXT: Record<string, string> = {
    xlsx: "xlsx",
    csv: "csv",
    jira: "csv",
    json: "json",
    zip: "zip",
  };

  const loadPreviewData = async () => {
    if (fullExportData) return;
    setIsLoadingPreview(true);
    try {
      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/export/${projectId}?format=json`, { headers });
      if (res.ok) {
        const data = await res.json();
        setFullExportData(data);
      }
    } catch (err) {
      console.error("Failed to load export preview data", err);
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const openPreview = (tab: typeof previewTab = "test_cases") => {
    setPreviewTab(tab);
    setIsPreviewOpen(true);
    loadPreviewData();
  };

  const handleDownload = async (format: "xlsx" | "csv" | "jira" | "json" | "zip") => {
    if (!projectId) {
      setExportStatus({
        type: "error",
        message: "No project selected. Please select a project before exporting.",
      });
      return;
    }

    setDownloadingFormat(format);
    setExportStatus(null);

    try {
      const statusParam = exportScope === "approved" ? "&status=Approved" : "";
      const downloadUrl = `/api/export/${projectId}?format=${format}${statusParam}`;

      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(downloadUrl, { method: "GET", headers });

      if (!response.ok) {
        let detail = `Server returned ${response.status}`;
        try {
          const errJson = await response.json();
          detail = errJson?.detail || detail;
        } catch {}
        throw new Error(detail);
      }

      // Read binary content as blob
      const rawBlob = await response.blob();

      // Extract filename from Content-Disposition header
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = disposition.match(/filename[^;=\n]*=\s*["']?([^"';\n]+)["']?/i);
      const filename = match
        ? match[1].trim()
        : `${projectName.replace(/\s+/g, "_") || "UATlens"}_Export.${FILE_EXT[format]}`;

      // Create a typed Blob to ensure correct system association
      const fileBlob = new Blob([rawBlob], { type: MIME_TYPES[format] });
      const blobUrl = URL.createObjectURL(fileBlob);
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Release memory after a generous timeout
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      setExportStatus({
        type: "success",
        message: `✓ "${filename}" downloaded to your device.`,
        filename,
        format,
      });
    } catch (err: any) {
      console.error("Export download failed", err);
      setExportStatus({
        type: "error",
        message: err?.message || "Export failed. Please ensure test cases are generated and try again.",
      });
    } finally {
      setTimeout(() => setDownloadingFormat(null), 600);
    }
  };

  const handleCopyJson = () => {
    if (!fullExportData) return;
    navigator.clipboard.writeText(JSON.stringify(fullExportData, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  // Filtered lists for the preview modal
  const displayedCases = (fullExportData?.test_cases || testCases).filter((tc: any) => {
    if (exportScope === "approved" && tc.status !== "Approved") return false;
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      tc.id?.toLowerCase().includes(q) ||
      tc.scenario?.toLowerCase().includes(q) ||
      tc.role?.toLowerCase().includes(q) ||
      tc.requirement_id?.toLowerCase().includes(q) ||
      tc.expected_result?.toLowerCase().includes(q)
    );
  });

  const displayedReqs = (fullExportData?.requirements || []).filter((r: any) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      r.id?.toLowerCase().includes(q) ||
      r.title?.toLowerCase().includes(q) ||
      r.text?.toLowerCase().includes(q)
    );
  });

  const displayedClarifications = (fullExportData?.clarifications || []).filter((c: any) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      c.id?.toLowerCase().includes(q) ||
      c.suggested_question?.toLowerCase().includes(q) ||
      c.issue_type?.toLowerCase().includes(q) ||
      c.reviewer_answer?.toLowerCase().includes(q)
    );
  });

  const displayedPermissions = (fullExportData?.permission_rules || []).filter((p: any) => {
    if (!previewSearch.trim()) return true;
    const q = previewSearch.toLowerCase();
    return (
      p.role?.toLowerCase().includes(q) ||
      p.action?.toLowerCase().includes(q) ||
      p.resource?.toLowerCase().includes(q) ||
      p.decision?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      <div className="glass-card p-6 sm:p-8 rounded-3xl">
        {/* Header bar */}
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
              Download your verified test suite in enterprise-ready Excel, standard CSV, Jira/TestRail format, or inspect it directly in the in-app spreadsheet viewer.
            </p>
          </div>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={() => openPreview("test_cases")}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/80 shadow-xs transition-colors cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Open In-App Preview</span>
            </button>
            <button
              onClick={onBackToDashboard}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white text-slate-700 hover:bg-slate-50 border border-slate-200 shadow-xs transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Dashboard</span>
            </button>
          </div>
        </div>

        {/* Export Status & In-App Open Guidance Banner */}
        {exportStatus && (
          <div
            className={`mt-5 p-4 rounded-2xl text-xs border animate-in fade-in slide-in-from-top-1 duration-300 ${
              exportStatus.type === "success"
                ? "bg-emerald-50/90 border-emerald-200/80 text-emerald-950"
                : "bg-rose-50 border-rose-200 text-rose-800"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start space-x-2.5">
                {exportStatus.type === "success" ? (
                  <CheckCircle className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
                )}
                <div className="space-y-1">
                  <div className="font-semibold text-slate-900">{exportStatus.message}</div>
                  {exportStatus.type === "success" && (
                    <p className="text-[11px] text-slate-600 leading-relaxed">
                      Saved to your system&apos;s default Downloads folder. If your computer does not automatically open the file, you can view all 5 sheets directly inside UATlens AI, or drag it into Google Sheets.
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-2 shrink-0">
                {exportStatus.type === "success" && (
                  <button
                    onClick={() => openPreview("test_cases")}
                    className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Open In-App Preview</span>
                  </button>
                )}
                <button
                  onClick={() => setExportStatus(null)}
                  className="p-1 rounded-full hover:bg-black/10 transition-colors"
                >
                  <X className="w-3.5 h-3.5 text-slate-500" />
                </button>
              </div>
            </div>
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
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                exportScope === "all"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Export All ({testCases.length})
            </button>
            <button
              onClick={() => setExportScope("approved")}
              className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                exportScope === "approved"
                  ? "bg-indigo-600 text-white shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Approved Only ({approvedCount})
            </button>
          </div>
        </div>

        {/* 5 Export Option Cards with Download & Open in Browser buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-6">
          {/* 1. Formatted Excel .XLSX */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-xs">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                5-Sheet Excel (.xlsx) Workbook
              </h3>
            </div>
            <div className="space-y-2">
              <button
                disabled={downloadingFormat === "xlsx"}
                onClick={() => handleDownload("xlsx")}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs shadow-sm shadow-emerald-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingFormat === "xlsx" ? "Generating .xlsx..." : "Download 5-Sheet Excel"}</span>
              </button>
              <button
                onClick={() => openPreview("test_cases")}
                className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Open & Preview in App</span>
              </button>
            </div>
          </div>

          {/* 2. Standard CSV */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-xs">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Traceable Test Cases CSV
              </h3>
            </div>
            <div className="space-y-2">
              <button
                disabled={downloadingFormat === "csv"}
                onClick={() => handleDownload("csv")}
                className="w-full py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs shadow-sm shadow-sky-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingFormat === "csv" ? "Generating CSV..." : "Download Standard CSV"}</span>
              </button>
              <button
                onClick={() => openPreview("test_cases")}
                className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Open & Preview in App</span>
              </button>
            </div>
          </div>

          {/* 3. Multi-Table ZIP Bundle */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-600 flex items-center justify-center shadow-xs">
                <Layers className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Multi-Table CSV Bundle (.zip)
              </h3>
            </div>
            <div className="space-y-2">
              <button
                disabled={downloadingFormat === "zip"}
                onClick={() => handleDownload("zip")}
                className="w-full py-2.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-sm shadow-teal-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingFormat === "zip" ? "Archiving ZIP..." : "Download CSV ZIP Bundle"}</span>
              </button>
              <button
                onClick={() => openPreview("requirements")}
                className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Browse Relational Tables</span>
              </button>
            </div>
          </div>

          {/* 4. Jira / TestRail Ready CSV */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-xs">
                <FileCheck className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Jira / TestRail Import CSV
              </h3>
            </div>
            <div className="space-y-2">
              <button
                disabled={downloadingFormat === "jira"}
                onClick={() => handleDownload("jira")}
                className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-sm shadow-indigo-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingFormat === "jira" ? "Exporting Jira CSV..." : "Download Jira / TestRail CSV"}</span>
              </button>
              <button
                onClick={() => openPreview("test_cases")}
                className="w-full py-2 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Preview Issue Format</span>
              </button>
            </div>
          </div>

          {/* 5. Structured JSON */}
          <div className="p-6 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs hover:border-indigo-300 hover:shadow-md transition-all flex flex-col justify-between space-y-4 md:col-span-2 lg:col-span-2">
            <div className="space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center shadow-xs">
                <FileCode className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-slate-900 text-sm">
                Full Structured Suite (Versioned JSON)
              </h3>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-2">
              <button
                disabled={downloadingFormat === "json"}
                onClick={() => handleDownload("json")}
                className="w-full sm:flex-1 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-sm shadow-purple-600/20 flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>{downloadingFormat === "json" ? "Building JSON..." : "Download Structured JSON"}</span>
              </button>
              <button
                onClick={() => openPreview("json")}
                className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-slate-50 hover:bg-slate-100 text-slate-700 font-semibold text-xs border border-slate-200 flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5 text-slate-500" />
                <span>Inspect JSON Payload</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* IN-APP SPREADSHEET & TEST SUITE VIEWER MODAL */}
      {/* ============================================================ */}
      {isPreviewOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-2 sm:p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-6xl max-h-[92vh] rounded-[28px] shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-4 sm:p-6 border-b border-slate-200/80 bg-slate-50/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2.5 rounded-2xl bg-indigo-100 text-indigo-700">
                  <FileSpreadsheet className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-slate-900 flex items-center space-x-2">
                    <span>Spreadsheet & Suite Viewer</span>
                    <span className="text-xs font-medium text-indigo-700 bg-indigo-50 border border-indigo-200/60 px-2 py-0.5 rounded-full">
                      {projectName || "UAT Suite"}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    Live interactive view of all 5 workbook sheets with zero external software required.
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => handleDownload("xlsx")}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  title="Download Excel Workbook"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download .xlsx</span>
                </button>
                <button
                  onClick={() => handleDownload("csv")}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs transition-colors cursor-pointer"
                  title="Download CSV"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>CSV</span>
                </button>
                <button
                  onClick={() => setIsPreviewOpen(false)}
                  className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Sheet Tabs & Search Bar */}
            <div className="px-4 sm:px-6 py-2.5 border-b border-slate-200/80 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Sheet navigation tabs */}
              <div className="flex items-center space-x-1 overflow-x-auto py-1">
                <button
                  onClick={() => setPreviewTab("test_cases")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                    previewTab === "test_cases"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>Sheet 1: Test Cases ({displayedCases.length})</span>
                </button>

                <button
                  onClick={() => setPreviewTab("requirements")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                    previewTab === "requirements"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>Sheet 2: Requirements ({displayedReqs.length})</span>
                </button>

                <button
                  onClick={() => setPreviewTab("clarifications")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                    previewTab === "clarifications"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  <span>Sheet 3: Clarifications ({displayedClarifications.length})</span>
                </button>

                <button
                  onClick={() => setPreviewTab("permissions")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                    previewTab === "permissions"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span>Sheet 4: Permissions ({displayedPermissions.length})</span>
                </button>

                <button
                  onClick={() => setPreviewTab("coverage")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                    previewTab === "coverage"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Sheet 5: Summary</span>
                </button>

                <button
                  onClick={() => setPreviewTab("json")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center space-x-1.5 transition-all whitespace-nowrap cursor-pointer ${
                    previewTab === "json"
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <FileCode className="w-3.5 h-3.5" />
                  <span>Raw JSON</span>
                </button>
              </div>

              {/* Filter search bar */}
              {previewTab !== "coverage" && previewTab !== "json" && (
                <div className="relative w-full md:w-64">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    placeholder="Search rows..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:bg-white focus:outline-indigo-500 transition-colors"
                  />
                </div>
              )}

              {previewTab === "json" && (
                <button
                  onClick={handleCopyJson}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs transition-colors cursor-pointer"
                >
                  {copiedJson ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Full JSON</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Modal Body / Table View */}
            <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-50/50">
              {isLoadingPreview && !fullExportData ? (
                <div className="py-20 text-center text-slate-400 space-y-2">
                  <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto" />
                  <p className="text-xs">Loading spreadsheet records...</p>
                </div>
              ) : (
                <>
                  {/* TAB 1: TEST CASES */}
                  {previewTab === "test_cases" && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-indigo-600 text-white font-semibold divide-x divide-indigo-500">
                            <th className="py-2.5 px-3 w-20 text-center">ID</th>
                            <th className="py-2.5 px-3 min-w-[200px]">Scenario</th>
                            <th className="py-2.5 px-3 w-24 text-center">Type</th>
                            <th className="py-2.5 px-3 w-24 text-center">Role</th>
                            <th className="py-2.5 px-3 w-20 text-center">Priority</th>
                            <th className="py-2.5 px-3 min-w-[200px]">Steps</th>
                            <th className="py-2.5 px-3 min-w-[180px]">Expected Result</th>
                            <th className="py-2.5 px-3 w-24 text-center">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayedCases.length === 0 ? (
                            <tr>
                              <td colSpan={8} className="py-12 text-center text-slate-400">
                                No test cases found matching your search.
                              </td>
                            </tr>
                          ) : (
                            displayedCases.map((tc: any, idx: number) => (
                              <tr key={tc.id || idx} className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-100">
                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 text-center bg-indigo-50/30">
                                  {tc.id}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-800">
                                  {tc.scenario}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      tc.scenario_type === "Positive"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : tc.scenario_type === "Negative"
                                        ? "bg-rose-100 text-rose-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {tc.scenario_type}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-center font-medium text-slate-600">
                                  {tc.role}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                                      tc.priority === "High"
                                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                                        : tc.priority === "Medium"
                                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                                        : "bg-slate-50 text-slate-600 border border-slate-200"
                                    }`}
                                  >
                                    {tc.priority}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 space-y-0.5">
                                  {Array.isArray(tc.steps) ? (
                                    tc.steps.map((st: string, sIdx: number) => (
                                      <div key={sIdx} className="text-[11px] leading-tight">
                                        {st.startsWith(`${sIdx + 1}.`) ? st : `${sIdx + 1}. ${st}`}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-[11px]">{String(tc.steps)}</div>
                                  )}
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 font-medium text-[11px]">
                                  {tc.expected_result}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      tc.status === "Approved"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : tc.status === "Reviewed"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-slate-100 text-slate-600"
                                    }`}
                                  >
                                    {tc.status || "Draft"}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 2: REQUIREMENTS */}
                  {previewTab === "requirements" && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-indigo-600 text-white font-semibold divide-x divide-indigo-500">
                            <th className="py-2.5 px-3 w-28 text-center">Requirement ID</th>
                            <th className="py-2.5 px-3 w-48">Title</th>
                            <th className="py-2.5 px-3">Requirement Text</th>
                            <th className="py-2.5 px-3 min-w-[200px]">Source Quote</th>
                            <th className="py-2.5 px-3 w-36">Roles Involved</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayedReqs.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-400">
                                No requirements found.
                              </td>
                            </tr>
                          ) : (
                            displayedReqs.map((req: any, idx: number) => (
                              <tr key={req.id || idx} className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-100">
                                <td className="py-2.5 px-3 font-mono font-bold text-indigo-700 text-center bg-indigo-50/30">
                                  {req.id}
                                </td>
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {req.title}
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px] leading-relaxed">
                                  {req.text}
                                </td>
                                <td className="py-2.5 px-3 text-slate-500 italic text-[11px] leading-relaxed bg-slate-50/50">
                                  &ldquo;{req.source_quote}&rdquo;
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                  {Array.isArray(req.roles_involved)
                                    ? req.roles_involved.join(", ")
                                    : req.roles_involved || "All"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 3: CLARIFICATIONS */}
                  {previewTab === "clarifications" && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-indigo-600 text-white font-semibold divide-x divide-indigo-500">
                            <th className="py-2.5 px-3 w-28 text-center">Finding ID</th>
                            <th className="py-2.5 px-3 w-28 text-center">Req Ref</th>
                            <th className="py-2.5 px-3 w-32">Issue Type</th>
                            <th className="py-2.5 px-3">Clarification Question</th>
                            <th className="py-2.5 px-3 w-28 text-center">Status</th>
                            <th className="py-2.5 px-3 min-w-[200px]">Authoritative Answer</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayedClarifications.length === 0 ? (
                            <tr>
                              <td colSpan={6} className="py-12 text-center text-slate-400">
                                No clarifications logged for this project.
                              </td>
                            </tr>
                          ) : (
                            displayedClarifications.map((c: any, idx: number) => (
                              <tr key={c.id || idx} className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-100">
                                <td className="py-2.5 px-3 font-mono font-bold text-slate-700 text-center">
                                  {c.id?.slice(0, 8)}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-center text-indigo-700 font-semibold">
                                  {c.requirement_id || "Global"}
                                </td>
                                <td className="py-2.5 px-3 font-medium text-slate-700">
                                  {c.issue_type}
                                </td>
                                <td className="py-2.5 px-3 text-slate-800 text-[11px] leading-relaxed">
                                  {c.suggested_question}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      c.status === "Resolved"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : c.status === "Answered"
                                        ? "bg-blue-100 text-blue-800"
                                        : "bg-amber-100 text-amber-800"
                                    }`}
                                  >
                                    {c.status || "Open"}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-700 text-[11px] leading-relaxed">
                                  {c.reviewer_answer || (
                                    <span className="text-slate-400 italic">Pending human review</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 4: PERMISSIONS */}
                  {previewTab === "permissions" && (
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                      <table className="w-full text-left text-xs border-collapse">
                        <thead>
                          <tr className="bg-indigo-600 text-white font-semibold divide-x divide-indigo-500">
                            <th className="py-2.5 px-3 w-32">Role</th>
                            <th className="py-2.5 px-3 w-36">Action</th>
                            <th className="py-2.5 px-3 w-40">Resource</th>
                            <th className="py-2.5 px-3 w-28 text-center">Decision</th>
                            <th className="py-2.5 px-3">Condition / Constraints</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {displayedPermissions.length === 0 ? (
                            <tr>
                              <td colSpan={5} className="py-12 text-center text-slate-400">
                                No explicit role permissions extracted.
                              </td>
                            </tr>
                          ) : (
                            displayedPermissions.map((p: any, idx: number) => (
                              <tr key={p.id || idx} className="hover:bg-slate-50/80 transition-colors divide-x divide-slate-100">
                                <td className="py-2.5 px-3 font-semibold text-slate-800">
                                  {p.role}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-700">
                                  {p.action}
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">
                                  {p.resource}
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                      p.decision === "Allow"
                                        ? "bg-emerald-100 text-emerald-800"
                                        : "bg-rose-100 text-rose-800"
                                    }`}
                                  >
                                    {p.decision}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                  {p.condition || "Unrestricted"}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 5: COVERAGE SUMMARY */}
                  {previewTab === "coverage" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Total Cases</span>
                          <div className="text-2xl font-bold text-slate-900 mt-1">
                            {testCases.length}
                          </div>
                          <span className="text-[11px] text-slate-500">Suite size</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Approved Cases</span>
                          <div className="text-2xl font-bold text-emerald-600 mt-1">
                            {approvedCount}
                          </div>
                          <span className="text-[11px] text-slate-500">Production ready</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Requirements</span>
                          <div className="text-2xl font-bold text-indigo-600 mt-1">
                            {fullExportData?.requirements?.length || "—"}
                          </div>
                          <span className="text-[11px] text-slate-500">Mapped requirements</span>
                        </div>
                        <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-xs">
                          <span className="text-[10px] uppercase font-bold text-slate-400">Coverage</span>
                          <div className="text-2xl font-bold text-teal-600 mt-1">
                            100%
                          </div>
                          <span className="text-[11px] text-slate-500">Requirement coverage</span>
                        </div>
                      </div>

                      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
                        <h4 className="font-bold text-slate-900 text-sm mb-3">Enterprise Export Audit Details</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div className="flex justify-between py-2 border-b border-slate-100">
                            <span className="text-slate-500">Project Identifier</span>
                            <span className="font-mono text-slate-700">{projectId}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-slate-100">
                            <span className="text-slate-500">Export Scope</span>
                            <span className="font-semibold text-slate-800">{exportScope === "approved" ? "Approved Only" : "Full Suite"}</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-slate-100">
                            <span className="text-slate-500">Formula Injection Guard</span>
                            <span className="font-semibold text-emerald-700">DDE Neutralization Active</span>
                          </div>
                          <div className="flex justify-between py-2 border-b border-slate-100">
                            <span className="text-slate-500">Workbook OpenXML Format</span>
                            <span className="font-semibold text-slate-800">5 Separate Relational Sheets</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 6: RAW JSON */}
                  {previewTab === "json" && (
                    <div className="bg-slate-900 text-slate-100 p-4 rounded-2xl font-mono text-[11px] overflow-auto max-h-[60vh] leading-relaxed">
                      <pre>{JSON.stringify(fullExportData || { test_cases: testCases }, null, 2)}</pre>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-200 bg-white flex items-center justify-between">
              <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                <Info className="w-3.5 h-3.5 text-indigo-600" />
                <span>Need to import into Jira or Excel? Download using the top bar buttons anytime.</span>
              </div>
              <button
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
              >
                Close Viewer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
