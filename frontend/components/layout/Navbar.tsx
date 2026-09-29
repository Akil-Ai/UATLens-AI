"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Sparkles, Layers, Plus, BookOpen, ShieldCheck, FolderGit2 } from "lucide-react";
import { ProjectSummary } from "@/types";

interface NavbarProps {
  currentProject: ProjectSummary | null;
  projects: ProjectSummary[];
  onSelectProject: (id: string) => void;
  onNewProject: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentProject,
  projects,
  onSelectProject,
  onNewProject,
}) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-3.5 backdrop-blur-xl bg-white/60 border-b border-white/80 shadow-sm transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2.5 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/20 group-hover:scale-105 transition-transform">
              <Sparkles className="w-5 h-5 text-indigo-100" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-slate-900 via-indigo-950 to-indigo-800 bg-clip-text text-transparent">
                  UATlens
                </span>
                <span className="px-1.5 py-0.5 text-[10px] font-bold tracking-wider uppercase rounded-md bg-indigo-100 text-indigo-700 border border-indigo-200/60">
                  AI
                </span>
              </div>
              <p className="text-[11px] font-medium text-slate-500 hidden sm:block">
                AI drafts, system validates, human approves
              </p>
            </div>
          </Link>
        </div>

        {/* Center / Right controls */}
        <div className="flex items-center space-x-3 sm:space-x-4">
          {/* Project Switcher */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center space-x-2 px-3.5 py-2 text-xs font-semibold rounded-xl bg-white/80 hover:bg-white border border-slate-200/80 text-slate-700 shadow-sm transition-all"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-indigo-600" />
              <span className="max-w-[140px] truncate">
                {currentProject ? currentProject.name : "Select Project"}
              </span>
              <span className="text-[10px] text-slate-400">▼</span>
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-2xl bg-white/95 backdrop-blur-2xl border border-white/90 shadow-xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Projects ({projects.length})
                  </span>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onNewProject();
                    }}
                    className="p-1 rounded-lg text-indigo-600 hover:bg-indigo-50 transition-colors"
                    title="Create new project"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {projects.length === 0 ? (
                    <p className="text-xs text-slate-400 px-3 py-2 text-center">No projects yet</p>
                  ) : (
                    projects.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => {
                          onSelectProject(p.id);
                          setDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors flex items-center justify-between ${
                          currentProject?.id === p.id
                            ? "bg-indigo-50 font-semibold text-indigo-700"
                            : "hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <span className="truncate pr-2">{p.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                          {p.test_case_count} TCs
                        </span>
                      </button>
                    ))
                  )}
                </div>
                <div className="pt-2 border-t border-slate-100">
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onNewProject();
                    }}
                    className="w-full flex items-center justify-center space-x-1.5 py-2 text-xs font-semibold text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Project</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New Project Button */}
          <button
            onClick={onNewProject}
            className="hidden md:flex items-center space-x-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 rounded-xl shadow-sm shadow-indigo-500/25 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>

          {/* How It Works Link */}
          <Link
            href="/how-it-works"
            className="flex items-center space-x-1 px-3 py-2 text-xs font-medium text-slate-600 hover:text-indigo-600 rounded-xl hover:bg-white/80 transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">How It Works</span>
          </Link>
        </div>
      </div>
    </header>
  );
};

# Commit ref: 59
