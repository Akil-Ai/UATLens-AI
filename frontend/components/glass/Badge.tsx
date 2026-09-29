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
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/80 shadow-xs ${className}`}>
          ● Positive
        </span>
      );
    }
    if (type === "Negative") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/80 shadow-xs ${className}`}>
          ▲ Negative
        </span>
      );
    }
    if (type === "Boundary") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/80 shadow-xs ${className}`}>
          ◆ Boundary
        </span>
      );
    }
  }

  if (priority) {
    if (priority === "High") {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200/60 ${className}`}>
          High
        </span>
      );
    }
    if (priority === "Medium") {
      return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200/60 ${className}`}>
          Medium
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200/60 ${className}`}>
        Low
      </span>
    );
  }

  if (status) {
    if (status === "Approved") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-300 ${className}`}>
          Approved
        </span>
      );
    }
    if (status === "Reviewed") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-sky-50 text-sky-700 border border-sky-200 ${className}`}>
          Reviewed
        </span>
      );
    }
    if (status === "Needs Clarification") {
      return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-300 ${className}`}>
          Needs Clarification
        </span>
      );
    }
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
        Draft
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200 ${className}`}>
      {label}
    </span>
  );
};

# Commit ref: 57
