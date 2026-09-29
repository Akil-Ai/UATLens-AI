import React from "react";
import { ScenarioType, PriorityType, TestCaseStatus } from "@/types";

interface BadgeProps {
  type?: ScenarioType | string;
  priority?: PriorityType | string;
  status?: TestCaseStatus | string;
  label?: string;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({
  type,
  priority,
  status,
  label,
  className = "",
}) => {
  if (type) {
    if (type === "Positive") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-800 border border-blue-500/30 backdrop-blur-md shadow-2xs ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5 shadow-[0_0_8px_rgba(0,117,255,0.85)]" />
          Positive
        </span>
      );
    }
    if (type === "Negative") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-800 border border-rose-500/30 backdrop-blur-md shadow-2xs ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5 shadow-[0_0_8px_rgba(244,63,94,0.8)]" />
          Negative
        </span>
      );
    }
    if (type === "Boundary") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-purple-500/10 text-purple-900 border border-purple-500/30 backdrop-blur-md shadow-2xs ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-purple-600 mr-1.5 shadow-[0_0_8px_rgba(147,51,234,0.85)]" />
          Boundary
        </span>
      );
    }
  }

  if (priority) {
    if (priority === "High") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-700 border border-rose-500/25 backdrop-blur-md ${className}`}>
          High
        </span>
      );
    }
    if (priority === "Medium") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-700 border border-amber-500/25 backdrop-blur-md ${className}`}>
          Medium
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-700 border border-blue-500/25 backdrop-blur-md ${className}`}>
        Low
      </span>
    );
  }

  if (status) {
    if (status === "Approved") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/15 text-blue-800 border border-blue-500/40 backdrop-blur-md ${className}`}>
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-1.5 shadow-[0_0_6px_rgba(0,117,255,0.85)]" />
          Approved
        </span>
      );
    }
    if (status === "Reviewed") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/15 text-violet-800 border border-violet-500/35 backdrop-blur-md ${className}`}>
          Reviewed
        </span>
      );
    }
    if (status === "Needs Clarification") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/15 text-amber-900 border border-amber-500/40 backdrop-blur-md ${className}`}>
          Needs Clarification
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-200/50 text-slate-700 border border-slate-300/60 backdrop-blur-md ${className}`}>
        Draft
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-white/60 text-slate-700 border border-white/80 backdrop-blur-md ${className}`}>
      {label}
    </span>
  );
};
