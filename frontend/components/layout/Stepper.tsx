"use client";

import React, { useState } from "react";
import { FileText, Cpu, Table2, BarChart3, Download, Check } from "lucide-react";

export type StepNumber = 1 | 2 | 3 | 4 | 5;

interface StepperProps {
  currentStep: StepNumber;
  maxReachedStep: StepNumber;
  onStepClick: (step: StepNumber) => void;
}

const STEPS = [
  { step: 1 as StepNumber, title: "Input", subtitle: "Requirements", icon: FileText },
  { step: 2 as StepNumber, title: "Context", subtitle: "Roles & Rules", icon: Cpu },
  { step: 3 as StepNumber, title: "Test Grid", subtitle: "Review Cases", icon: Table2 },
  { step: 4 as StepNumber, title: "Dashboard", subtitle: "Metrics", icon: BarChart3 },
  { step: 5 as StepNumber, title: "Export", subtitle: "Download", icon: Download },
];

export const Stepper: React.FC<StepperProps> = ({
  currentStep,
  maxReachedStep,
  onStepClick,
}) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div 
      className="fixed left-4 top-1/2 -translate-y-1/2 z-50 flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`liquid-glass py-4 px-2.5 rounded-full flex flex-col items-start gap-4 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white/90 border border-slate-200/60 ${
          isHovered ? "w-48" : "w-[60px]"
        }`}
      >
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
                className={`flex items-center space-x-3 w-full rounded-2xl transition-all ${
                  isCurrent
                    ? "opacity-100"
                    : isClickable
                    ? "hover:opacity-80 opacity-80 cursor-pointer"
                    : "opacity-60 cursor-not-allowed"
                }`}
              >
                {/* Step badge/icon with Orange Gradient */}
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all shadow-sm ${
                    isCurrent
                      ? "bg-gradient-to-tr from-orange-500 via-orange-600 to-amber-600 text-white shadow-orange-500/30 scale-105"
                      : isCompleted && item.step < currentStep
                      ? "bg-orange-500/90 text-white border border-orange-400/50"
                      : "bg-slate-100 text-slate-400 border border-slate-200/60"
                  }`}
                >
                  {isCompleted && item.step < currentStep ? (
                    <Check className="w-5 h-5 stroke-[2.5]" />
                  ) : (
                    <Icon className="w-5 h-5" />
                  )}
                </div>

                {/* Text titles - visible only on hover */}
                <div 
                  className={`flex flex-col items-start overflow-hidden whitespace-nowrap transition-all duration-300 ${
                    isHovered ? "opacity-100 max-w-[120px] translate-x-0" : "opacity-0 max-w-0 -translate-x-4"
                  }`}
                >
                  <h4
                    className={`text-sm font-semibold leading-tight ${
                      isCurrent ? "text-orange-600 font-bold" : "text-slate-700"
                    }`}
                  >
                    {item.title}
                  </h4>
                  <p className="text-[10px] text-slate-500">{item.subtitle}</p>
                </div>
              </button>

              {/* Connecting line / separator */}
              {idx < STEPS.length - 1 && (
                <div className="w-0.5 h-4 bg-slate-200/80 mx-auto rounded-full relative overflow-hidden flex-shrink-0">
                  <div
                    className={`w-full transition-all duration-500 ${
                      item.step < currentStep
                        ? "bg-gradient-to-b from-orange-500 to-amber-500 h-full"
                        : item.step === currentStep
                        ? "bg-gradient-to-b from-orange-500 to-orange-400 h-1/2"
                        : "h-0"
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
