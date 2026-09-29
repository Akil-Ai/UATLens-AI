"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, FileText, Sparkles, CheckCircle2, AlertTriangle, Table as TableIcon, Heading, RefreshCw, X } from "lucide-react";
import { parseUploadedDocument, fetchSampleDocument } from "@/lib/api";

interface Stage1InputProps {
  projectName: string;
  onProjectNameChange: (name: string) => void;
  rawText: string;
  onRawTextChange: (text: string) => void;
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export const Stage1Input: React.FC<Stage1InputProps> = ({
  projectName,
  onProjectNameChange,
  rawText,
  onRawTextChange,
  onAnalyze,
  isAnalyzing,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [parseMetadata, setParseMetadata] = useState<{
    filename: string;
    word_count: number;
    character_count: number;
    headings: string[];
    tables: any[];
    warnings: string[];
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (file: File) => {
    setErrorMessage(null);
    setIsUploading(true);
    try {
      const data = await parseUploadedDocument(file);
      // Append or replace
      const combined = rawText.trim() ? `${rawText}\n\n---\n# ${data.filename}\n\n${data.parsed_text}` : data.parsed_text;
      onRawTextChange(combined);
      setParseMetadata({
        filename: data.filename,
        word_count: data.word_count,
        character_count: data.character_count,
        headings: data.headings || [],
        tables: data.tables || [],
        warnings: data.warnings || [],
      });
      if (!projectName || projectName === "Untitled Project") {
        const baseName = file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " ");
        onProjectNameChange(baseName.charAt(0).toUpperCase() + baseName.slice(1));
      }
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to parse document.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleLoadSample = async () => {
    setErrorMessage(null);
    setIsUploading(true);
    try {
      const data = await fetchSampleDocument();
      onRawTextChange(data.content);
      onProjectNameChange("GlobalRetail Checkout & Orders");
      setParseMetadata({
        filename: data.filename,
        word_count: data.word_count,
        character_count: data.character_count,
        headings: [
          "System Overview & User Roles",
          "Cart Constraints & Limits",
          "Promotion & Coupon Rules",
          "Checkout & Payment Processing",
          "Order State Lifecycle & Cancellation Rules",
          "Returns & Refund Authorizations"
        ],
        tables: [{ row_count: 4, col_count: 4, columns: ["Field", "Min Constraint", "Max Constraint", "Error Behavior"] }],
        warnings: []
      });
    } catch (err: any) {
      setErrorMessage(err.message || "Could not load sample document.");
    } finally {
      setIsUploading(false);
    }
  };

  const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
  const charCount = rawText.length;

  return (
    <div className="w-full max-w-5xl mx-auto space-y-6">
      {/* Top Header Card */}
      <div className="glass-card p-6 sm:p-8 rounded-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200/60 text-indigo-700 text-xs font-semibold mb-2">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Stage 1 of 5</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              Provide Business Requirements
            </h2>
            <p className="text-sm text-slate-500 mt-1 max-w-2xl">
              Paste user stories, acceptance criteria, or upload product specs (PDF, DOCX, TXT, MD). UATlens will extract roles, boundaries, and validation rules.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleLoadSample}
              disabled={isUploading}
              className="flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-white/90 hover:bg-white text-indigo-700 border border-indigo-200 shadow-sm hover:shadow transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isUploading ? "animate-spin" : ""}`} />
              <span>Load Sample (E-Commerce)</span>
            </button>
          </div>
        </div>

        {/* Project Name Input */}
        <div className="mt-6">
          <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
            Project / Feature Name
          </label>
          <input
            type="text"
            value={projectName}
            onChange={(e) => onProjectNameChange(e.target.value)}
            placeholder="e.g., E-Commerce Checkout & Payment Gateway"
            className="w-full px-4 py-3 text-sm font-medium glass-input text-slate-800 placeholder-slate-400"
          />
        </div>

        {/* Drag & Drop File Zone */}
        <div className="mt-6">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                handleFileUpload(e.dataTransfer.files[0]);
              }
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-2xl border-2 border-dashed p-6 text-center transition-all ${
              isDragging
                ? "border-indigo-500 bg-indigo-50/60 scale-[1.01]"
                : "border-slate-300/80 hover:border-indigo-400 bg-white/40 hover:bg-white/60"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.md,.markdown"
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  handleFileUpload(e.target.files[0]);
                }
              }}
            />
            <div className="flex flex-col items-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 shadow-xs">
                <UploadCloud className="w-6 h-6" />
              </div>
              <div className="text-xs font-semibold text-slate-700">
                <span className="text-indigo-600 hover:underline">Click to upload</span> or drag and drop document
              </div>
              <p className="text-[11px] text-slate-400">
                PDF, DOCX, Markdown, or TXT (Max 10 MB). Tables and headings are automatically preserved.
              </p>
            </div>
          </div>
        </div>

        {/* Error message alert */}
        {errorMessage && (
          <div className="mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="text-rose-500 hover:text-rose-700">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Parser Preview Panel */}
        {parseMetadata && (
          <div className="mt-5 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 text-xs font-semibold text-slate-700">
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Parsed Document Preview: <strong className="text-indigo-900">{parseMetadata.filename}</strong></span>
              </div>
              <div className="flex items-center space-x-3 text-slate-500 text-[11px]">
                <span>{parseMetadata.word_count.toLocaleString()} words</span>
                <span>•</span>
                <span>{parseMetadata.character_count.toLocaleString()} chars</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 text-xs">
              {/* Detected Headings */}
              <div className="p-3 bg-white/80 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-1.5 font-bold text-slate-700 mb-1.5">
                  <Heading className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Detected Headings ({parseMetadata.headings.length})</span>
                </div>
                {parseMetadata.headings.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No explicit headings found</p>
                ) : (
                  <ul className="space-y-1 text-[11px] text-slate-600 max-h-24 overflow-y-auto">
                    {parseMetadata.headings.slice(0, 6).map((h, i) => (
                      <li key={i} className="truncate">• {h}</li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Detected Tables */}
              <div className="p-3 bg-white/80 rounded-xl border border-slate-100">
                <div className="flex items-center space-x-1.5 font-bold text-slate-700 mb-1.5">
                  <TableIcon className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Detected Tables ({parseMetadata.tables.length})</span>
                </div>
                {parseMetadata.tables.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No structured pipe tables</p>
                ) : (
                  <ul className="space-y-1 text-[11px] text-slate-600 max-h-24 overflow-y-auto">
                    {parseMetadata.tables.map((t, i) => (
                      <li key={i} className="truncate">
                        • Table {i+1}: {t.row_count} rows, {t.col_count} columns
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>

            {parseMetadata.warnings.length > 0 && (
              <div className="mt-3 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                {parseMetadata.warnings.map((w, i) => (
                  <p key={i}>⚠️ {w}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Textarea */}
        <div className="mt-6">
          <div className="flex items-center justify-between mb-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Requirements Document Content
            </label>
            <span className="text-[11px] font-medium text-slate-400">
              {wordCount.toLocaleString()} words | {charCount.toLocaleString()} / 60,000 chars
            </span>
          </div>
          <textarea
            rows={12}
            value={rawText}
            onChange={(e) => onRawTextChange(e.target.value)}
            placeholder="Paste your requirement document, user stories, or acceptance criteria here..."
            className="w-full p-4 text-xs font-mono glass-input text-slate-800 placeholder-slate-400 leading-relaxed resize-y"
          />
        </div>

        {/* Bottom Action Footer */}
        <div className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 pt-6 border-t border-slate-200/60">
          <p className="text-xs text-slate-500">
            {charCount > 0 ? "Ready to analyze requirements." : "Enter or upload requirements to proceed."}
          </p>

          <button
            onClick={onAnalyze}
            disabled={!rawText.trim() || isAnalyzing}
            className={`w-full sm:w-auto px-7 py-3 rounded-2xl text-xs font-bold uppercase tracking-wider text-white shadow-lg transition-all flex items-center justify-center space-x-2 ${
              rawText.trim() && !isAnalyzing
                ? "bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 hover:from-indigo-500 hover:to-purple-500 shadow-indigo-500/25 hover:scale-[1.02] cursor-pointer"
                : "bg-slate-300 shadow-none cursor-not-allowed"
            }`}
          >
            {isAnalyzing ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                <span>Extracting Context...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-indigo-200" />
                <span>Analyze & Extract Context</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
