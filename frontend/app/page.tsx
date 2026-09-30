"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { BackgroundOrbs } from "@/components/layout/BackgroundOrbs";
import { Navbar } from "@/components/layout/Navbar";
import { Stepper, StepNumber } from "@/components/layout/Stepper";
import { Stage1Input } from "@/components/stage1-input/Stage1Input";
import { Stage2Context } from "@/components/stage2-context/Stage2Context";
import { Stage3Grid } from "@/components/stage3-grid/Stage3Grid";
import { Stage4Dashboard } from "@/components/stage4-dashboard/Stage4Dashboard";
import { Stage5Export } from "@/components/stage5-export/Stage5Export";
import {
  fetchProjects,
  createProject,
  extractContext,
  fetchContext,
  updateContext,
  fetchTestCases,
} from "@/lib/api";
import { getAccessToken, supabase, setAuthCookies } from "@/lib/supabase";
import { ProjectSummary, ExtractedContextData, TestCase } from "@/types";

const EMPTY_CONTEXT: ExtractedContextData = {
  roles: [],
  actions: [],
  business_rules: [],
  conditions: [],
  state_changes: [],
  dependencies: [],
  requirements: [],
  ambiguities: [],
};

export default function Home() {
  // ── App-level state ──
  const [currentStep, setCurrentStep] = useState<StepNumber>(1);
  const [maxReachedStep, setMaxReachedStep] = useState<StepNumber>(1);

  // ── Project state ──
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [currentProject, setCurrentProject] = useState<ProjectSummary | null>(null);
  const [projectName, setProjectName] = useState("Untitled Project");
  const [rawText, setRawText] = useState("");

  // ── Context extraction state ──
  const [contextData, setContextData] = useState<ExtractedContextData>(EMPTY_CONTEXT);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // ── Test case generation state ──
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState({ completed: 0, total: 0, message: "" });
  const abortRef = useRef<AbortController | null>(null);

  // ── Authentication gate ──
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // ── Verify session authentication on mount ──
  useEffect(() => {
    async function checkAuth() {
      if (typeof window === "undefined") return;

      try {
        const { data } = await supabase.auth.getSession();
        const hasSbCookie = document.cookie
          .split("; ")
          .some((c) => c.startsWith("sb-access-token="));
        const hasLegacyCookie = document.cookie
          .split("; ")
          .some((c) => c.startsWith("uatlens_auth="));

        // If no active Supabase session and no auth cookies, redirect to login
        if (!data?.session && !hasSbCookie && !hasLegacyCookie) {
          setIsAuthenticated(false);
          window.location.href = "/login";
          return;
        }

        // Sync session cookies and user profile if available
        if (data?.session) {
          setAuthCookies(data.session.access_token, data.session.refresh_token);
          if (!sessionStorage.getItem("uatlens_user")) {
            sessionStorage.setItem(
              "uatlens_user",
              JSON.stringify({
                id: data.session.user?.id,
                email: data.session.user?.email,
                name: data.session.user?.user_metadata?.name || data.session.user?.email?.split("@")[0] || "User",
                role: data.session.user?.user_metadata?.role || "QA Lead",
                loginTime: new Date().toISOString(),
              })
            );
          }
        }

        setIsAuthenticated(true);
        loadProjects();
      } catch (err) {
        console.error("Auth check error:", err);
        const hasCookie =
          document.cookie.includes("sb-access-token=") ||
          document.cookie.includes("uatlens_auth=");
        if (hasCookie) {
          setIsAuthenticated(true);
          loadProjects();
        } else {
          setIsAuthenticated(false);
          window.location.href = "/login";
        }
      }
    }

    checkAuth();
  }, []);

  const loadProjects = async () => {
    try {
      const data = await fetchProjects();
      setProjects(data);
    } catch (err) {
      console.error("Failed to load projects:", err);
    }
  };

  // ── Project management ──
  const handleSelectProject = useCallback(async (id: string) => {
    const p = projects.find((proj) => proj.id === id) || null;
    if (!p) return;
    setCurrentProject(p);
    setProjectName(p.name);

    // Load existing context if available
    try {
      const ctx = await fetchContext(id);
      if (ctx && ctx.context) {
        setContextData(ctx.context);
        setCurrentStep(2);
        setMaxReachedStep(2);
      }
    } catch { /* no saved context */ }

    // Load existing test cases if available
    try {
      const cases = await fetchTestCases(id);
      if (cases && cases.length > 0) {
        setTestCases(cases);
        setCurrentStep(3);
        setMaxReachedStep(3);
      }
    } catch { /* no cases yet */ }
  }, [projects]);

  const handleNewProject = useCallback(() => {
    setCurrentProject(null);
    setProjectName("Untitled Project");
    setRawText("");
    setContextData(EMPTY_CONTEXT);
    setTestCases([]);
    setCurrentStep(1);
    setMaxReachedStep(1);
  }, []);

  // ── Stage 1 → Stage 2: Analyze & Extract Context ──
  const handleAnalyze = useCallback(async () => {
    if (!rawText.trim()) return;
    setIsAnalyzing(true);

    try {
      // Create project if not exists
      let projId = currentProject?.id;
      if (!projId) {
        const newProject = await createProject(projectName, rawText);
        projId = newProject.id;
        setCurrentProject(newProject);
        await loadProjects();
      }

      // Call extract-context endpoint
      const result = await extractContext(projId!, rawText);
      setContextData(result.context || result);
      setCurrentStep(2);
      setMaxReachedStep((prev) => Math.max(prev, 2) as StepNumber);
    } catch (err: any) {
      console.error("Extraction failed:", err);
      alert(err.message || "Failed to extract context.");
    } finally {
      setIsAnalyzing(false);
    }
  }, [rawText, projectName, currentProject]);

  // ── Stage 2 → Stage 3: Generate Test Cases (SSE Streaming) ──
  const handleGenerateTestCases = useCallback(async (targetReqId?: string | unknown) => {
    if (!currentProject?.id) return;
    const cleanTargetId =
      typeof targetReqId === "string" &&
      targetReqId.trim().length > 0 &&
      targetReqId !== "[object Object]"
        ? targetReqId.trim()
        : undefined;

    setCurrentStep(3);
    setMaxReachedStep((prev) => Math.max(prev, 3) as StepNumber);
    setIsGenerating(true);
    setIsStreaming(true);
    if (!cleanTargetId) {
      setTestCases([]);
    }
    setStreamProgress({
      completed: 0,
      total: 0,
      message: cleanTargetId ? `Regenerating ${cleanTargetId}...` : "Starting generation...",
    });

    // Save any context edits before generating
    try {
      await updateContext(currentProject.id, contextData);
    } catch (err) {
      console.warn("Could not save context edits:", err);
    }

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const url = cleanTargetId
        ? `/api/generate-test-cases?project_id=${currentProject.id}&target_requirement_id=${encodeURIComponent(cleanTargetId)}`
        : `/api/generate-test-cases?project_id=${currentProject.id}`;

      const token = await getAccessToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: "POST",
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errDetail = "";
        try {
          const errJson = await response.json();
          errDetail = errJson.detail || errJson.message || "";
        } catch {
          errDetail = await response.text();
        }
        throw new Error(errDetail || `Server returned status ${response.status} starting generation.`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No readable stream.");

      const decoder = new TextDecoder();
      let buffer = "";
      const accumulated: TestCase[] = cleanTargetId ? [...testCases.filter(t => t.requirement_id !== cleanTargetId)] : [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const parsed = JSON.parse(line.slice(6));
            if (parsed.event === "test_case" && parsed.data) {
              accumulated.push(parsed.data as TestCase);
              setTestCases([...accumulated]);
            } else if (parsed.event === "progress") {
              setStreamProgress({
                completed: parsed.completed || 0,
                total: parsed.total || 0,
                message: parsed.message || "Generating...",
              });
            } else if (parsed.event === "complete") {
              setStreamProgress({
                completed: parsed.total_generated || accumulated.length,
                total: parsed.total_generated || accumulated.length,
                message: parsed.message || "Complete!",
              });
            }
          } catch { /* skip malformed events */ }
        }
      }

      // Reload fresh persisted suite to ensure atomic sync
      try {
        const fresh = await fetchTestCases(currentProject.id);
        if (Array.isArray(fresh)) {
          setTestCases(fresh);
        } else {
          setTestCases([...accumulated]);
        }
      } catch {
        setTestCases([...accumulated]);
      }

      setCurrentStep(3);
      setMaxReachedStep((prev) => Math.max(prev, 3) as StepNumber);
    } catch (err: any) {
      if (err.name !== "AbortError") {
        console.error("Generation failed:", err);
        alert("Test case generation failed. Please retry.");
      }
    } finally {
      setIsGenerating(false);
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [currentProject, contextData, testCases]);

  const handleCancelStream = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // ── Navigation helpers ──
  const goToStep = useCallback((step: StepNumber) => {
    setCurrentStep(step);
  }, []);

  const handleFilterGrid = useCallback(
    (_filterType: string, _value: string) => {
      // Navigate to grid view when chart segment is clicked
      setCurrentStep(3);
    },
    []
  );

  if (isAuthenticated === null || !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 relative overflow-hidden">
        <BackgroundOrbs />
        <div className="liquid-glass p-8 sm:p-10 rounded-3xl flex flex-col items-center space-y-4 border border-white/90 shadow-2xl relative z-10 max-w-sm w-full text-center">
          <img
            src="/logo.png"
            alt="UATlens AI"
            className="h-10 w-auto object-contain animate-pulse"
          />
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-800">Verifying Authorization</h3>
            <p className="text-xs text-slate-500">Redirecting to secure login portal...</p>
          </div>
          <div className="flex items-center space-x-2 text-[11px] font-semibold text-blue-700 bg-blue-50/80 px-3 py-1 rounded-full border border-blue-200/50">
            <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
            <span>Authentication Required</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen">
      <BackgroundOrbs />

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          currentProject={currentProject}
          projects={projects}
          onSelectProject={handleSelectProject}
          onNewProject={handleNewProject}
        />

        <Stepper
          currentStep={currentStep}
          maxReachedStep={maxReachedStep}
          onStepClick={goToStep}
        />

        <main className="flex-1 px-4 sm:px-6 pb-12">
          {/* ─── STAGE 1: Input ─── */}
          {currentStep === 1 && (
            <Stage1Input
              projectName={projectName}
              onProjectNameChange={setProjectName}
              rawText={rawText}
              onRawTextChange={setRawText}
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
            />
          )}

          {/* ─── STAGE 2: Context Review ─── */}
          {currentStep === 2 && (
                      <Stage2Context
              contextData={contextData}
              onContextDataChange={setContextData}
              onProceedToGenerate={() => handleGenerateTestCases()}
              onBackToInput={() => goToStep(1)}
              isGenerating={isGenerating}
              projectId={currentProject?.id}
            />
          )}

          {/* ─── STAGE 3: Test Case Grid ─── */}
          {currentStep === 3 && currentProject && (
            <Stage3Grid
              projectId={currentProject.id}
              testCases={testCases}
              onTestCasesChange={setTestCases}
              isStreaming={isStreaming}
              streamProgress={streamProgress}
              onCancelStream={handleCancelStream}
              onProceedToDashboard={() => {
                setCurrentStep(4);
                setMaxReachedStep((prev) => Math.max(prev, 4) as StepNumber);
              }}
              rawDocumentText={rawText}
              onRegenerateTargeted={(reqId) => handleGenerateTestCases(reqId)}
            />
          )}

          {/* ─── STAGE 4: Analytics Dashboard ─── */}
          {currentStep === 4 && (
            <Stage4Dashboard
              testCases={testCases}
              onFilterGrid={handleFilterGrid}
              projectId={currentProject?.id}
              onProceedToExport={() => {
                setCurrentStep(5);
                setMaxReachedStep((prev) => Math.max(prev, 5) as StepNumber);
              }}
              onBackToGrid={() => goToStep(3)}
              onNavigateToStage2={() => goToStep(2)}
            />
          )}

          {/* ─── STAGE 5: Export ─── */}
          {currentStep === 5 && currentProject && (
            <Stage5Export
              projectId={currentProject.id}
              projectName={projectName}
              testCases={testCases}
              onBackToDashboard={() => goToStep(4)}
            />
          )}
        </main>

        {/* Footer */}
        <footer className="text-center py-4 text-[11px] text-slate-400 border-t border-white/40">
          <span className="font-medium">UATlens AI</span> — AI drafts, system validates, human approves.
          <span className="mx-1.5">•</span>
          Zero hallucination tolerance powered by deterministic validation.
        </footer>
      </div>
    </div>
  );
}
