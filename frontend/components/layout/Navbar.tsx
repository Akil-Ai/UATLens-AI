"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { Plus, FolderGit2, User, ChevronDown, LogOut, ShieldCheck } from "lucide-react";
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
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [user, setUser] = useState<{ name: string; email: string; role: string } | null>(null);

  useEffect(() => {
    try {
      const stored = sessionStorage.getItem("uatlens_user");
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {}
  }, []);

  const handleSignOut = () => {
    // Clear session cookie and session storage
    document.cookie = "uatlens_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
    sessionStorage.removeItem("uatlens_user");
    window.location.href = "/login";
  };

  return (
    <header className="sticky top-0 z-40 w-full px-4 sm:px-8 py-3 backdrop-blur-2xl bg-white/70 border-b border-white/80 shadow-xs transition-all">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        {/* Brand with Official UATlens AI Logo */}
        <div className="flex items-center space-x-3">
          <Link href="/" className="flex items-center space-x-2.5 group">
            {/* Logo Image */}
            <div className="relative flex items-center">
              <img
                src="/logo.png"
                alt="UATlens AI Logo"
                className="h-9 sm:h-10 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              />
            </div>
          </Link>
        </div>

        {/* Center / Right controls with Liquid Glass Pills */}
        <div className="flex items-center space-x-2 sm:space-x-3">
          {/* Project Switcher Liquid Pill */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="liquid-glass-pill flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-all cursor-pointer"
            >
              <FolderGit2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="max-w-[130px] truncate">
                {currentProject ? currentProject.name : "Select Project"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400" />
            </button>

            {dropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/95 shadow-2xl p-2 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-2 border-b border-slate-100 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Projects ({projects.length})
                  </span>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      onNewProject();
                    }}
                    className="p-1 rounded-full text-blue-600 hover:bg-blue-50 transition-colors"
                    title="Create new project"
                  >
                    <Plus className="w-3.5 h-3.5" />
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
                        className={`w-full text-left px-3 py-2 rounded-2xl text-xs transition-colors flex items-center justify-between ${
                          currentProject?.id === p.id
                            ? "bg-blue-50/80 font-semibold text-blue-700 border border-blue-100"
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
                    className="w-full flex items-center justify-center space-x-1.5 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-50/80 rounded-2xl transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>New Project</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* New Project Capsule Button */}
          <button
            onClick={onNewProject}
            className="hidden md:flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 via-indigo-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 rounded-full shadow-md shadow-blue-500/25 hover:scale-[1.02] transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>New Project</span>
          </button>


          {/* User Account / Profile & Sign Out Dropdown */}
          <div className="relative">
            <button
              onClick={() => setUserDropdownOpen(!userDropdownOpen)}
              className="liquid-glass-pill flex items-center space-x-2 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:text-blue-600 group transition-all cursor-pointer"
              title="Account Settings & Session"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-tr from-blue-600 to-violet-600 text-white flex items-center justify-center text-[10px] font-bold shadow-2xs group-hover:scale-110 transition-transform">
                {user ? user.name.charAt(0).toUpperCase() : <User className="w-3 h-3" />}
              </div>
              <span className="hidden sm:inline font-medium text-slate-700">
                {user ? user.name.split(" ")[0] : "Account"}
              </span>
              <ChevronDown className="w-3 h-3 text-slate-400 group-hover:text-blue-600 transition-colors" />
            </button>

            {userDropdownOpen && (
              <div className="absolute right-0 mt-2 w-64 rounded-3xl bg-white/95 backdrop-blur-2xl border border-white/95 shadow-2xl p-3 z-50 animate-in fade-in zoom-in-95">
                <div className="px-2 py-2 border-b border-slate-100">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-600 to-violet-600 text-white flex items-center justify-center text-xs font-bold shadow-xs shrink-0">
                      {user ? user.name.charAt(0).toUpperCase() : "U"}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-bold text-slate-900 truncate">
                        {user ? user.name : "Authorized QA Lead"}
                      </p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {user ? user.email : "alex.morgan@enterprise.io"}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center space-x-1.5">
                    <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[10px] font-semibold border border-blue-100 flex items-center space-x-1">
                      <ShieldCheck className="w-3 h-3 text-blue-600" />
                      <span>{user?.role || "QA Lead"}</span>
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[10px] font-semibold border border-emerald-100">
                      Authenticated
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    onClick={handleSignOut}
                    className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-50/80 rounded-2xl transition-colors cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
