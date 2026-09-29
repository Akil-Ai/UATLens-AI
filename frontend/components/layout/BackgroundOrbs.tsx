"use client";

import React from "react";

export const BackgroundOrbs: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Orb 1: Indigo */}
      <div
        className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-indigo-400 opacity-30 filter blur-3xl animate-float-slow"
        style={{ animationDuration: "16s" }}
      />
      {/* Orb 2: Violet */}
      <div
        className="absolute top-1/3 -right-28 w-[28rem] h-[28rem] rounded-full bg-purple-400 opacity-25 filter blur-3xl animate-float-reverse"
        style={{ animationDuration: "20s" }}
      />
      {/* Orb 3: Cyan */}
      <div
        className="absolute -bottom-32 left-1/4 w-[32rem] h-[32rem] rounded-full bg-cyan-300 opacity-30 filter blur-3xl animate-pulse-subtle"
        style={{ animationDuration: "12s" }}
      />
    </div>
  );
};
