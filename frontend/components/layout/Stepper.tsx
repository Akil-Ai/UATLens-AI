"use client";

import React from "react";
import { FileText, Cpu, Table2, BarChart3, Download, Check } from "lucide-react";

export type StepNumber = 1 | 2 | 3 | 4 | 5;

interface StepperProps {
  currentStep: StepNumber;
  maxReachedStep: StepNumber;
  onStepClick: (step: StepNumber) => void;
}

const STEPS = [
  { step: 1 as StepNumber, title: "Input", subtitle: "Requirements & Docs", icon: FileText },
  { step: 2 as StepNumber, title: "Context Review", subtitle: "Roles & Rules", icon: Cpu },
  { step: 3 as StepNumber, title: "Test Case Grid", subtitle: "Review & Generate", icon: Table2 },
  { step: 4 as StepNumber, title: "Dashboard", subtitle: "Coverage & Metrics", icon: BarChart3 },
  { step: 5 as StepNumber, title: "Export", subtitle: "Excel & Multi-format", icon: Download },
];

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  maxReachedStep,
  onStepClick,
}) => {
  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-4 sm:py-6">
      <div className="glass-card p-3 sm:p-4 rounded-2xl flex items-center justify-between relative overflow-hidden">
        {STEPS.map((item, idx) => {
          const isCurrent = currentStep === item.step;
          const isCompleted = item.step < currentStep || item.step <= maxReachedStep;
          const isClickable = item.step <= maxReachedStep;
          const Icon = item.icon;

          return (
            <React.Fragment key={item.step}>
              {/* Step item */}
              <button
                disabled={!isClickable}
                onClick={() => isClickable && onStepClick(item.step)}
                className={`flex items-center space-x-3 text-left p-2 rounded-xl transition-all ${
                  isCurrent
                    ? "bg-indigo-50/90 border border-indigo-200/80 shadow-sm"
                    : isClickable
                    ? "hover:bg-white/80 cursor-pointer"
                    : "opacity-45 cursor-not-allowed"
                }`}
              >
                {/* Step badge/icon */}
                <div
                  className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center font-bold text-xs sm:text-sm transition-all ${
                    isCurrent
                      ? "bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25 scale-105"
                      : isCompleted && item.step < currentStep
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-200 text-slate-600"
                  }`}
                >
                  {isCompleted && item.step < currentStep ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 stroke-[2.5]" />
                  ) : (
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  )}
                </div>

                {/* Text titles */}
                <div className="hidden md:block">
                  <div className="flex items-center space-x-1.5">
                    <span className="text-[10px] uppercase font-bold text-slate-400">
                      Step {item.step}
                    </span>
                  </div>
                  <h4
                    className={`text-xs sm:text-sm font-semibold leading-tight ${
                      isCurrent ? "text-indigo-950 font-bold" : "text-slate-700"
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-slate-500">{item.subtitle}</p>
                </div>
              </button>

              {/* Connecting line */}
              {idx < STEPS.length - 1 && (
                <div className="flex-1 mx-2 sm:mx-3 h-0.5 bg-slate-200/80 relative overflow-hidden hidden sm:block">
                  <div
                    className={`h-full transition-all duration-500 ${
                      item.step < currentStep
                        ? "bg-emerald-500 w-full"
                        : item.step === currentStep
                        ? "bg-indigo-500 w-1/2"
                        : "w-0"
                    }`}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

# Commit ref: 60
