"use client";

import React from "react";

export const BackgroundOrbs: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" aria-hidden="true">
      {/* Morphing Liquid Droplet 1: Vivid Violet & Purple (Logo 'AI' Glow - Top Right) */}
      <div 
        className="absolute -top-[16rem] right-[-6rem] w-[46rem] h-[46rem] opacity-45 filter blur-[80px] animate-liquid-blob pointer-events-none"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(124, 58, 237, 0.45) 0%, rgba(0, 117, 255, 0.4) 45%, rgba(0, 210, 255, 0.2) 80%, transparent 100%)",
        }}
      />

      {/* Morphing Liquid Droplet 2: Electric Azure Blue (Logo 'lens' Glow - Left Center) */}
      <div 
        className="absolute top-[25%] -left-36 w-[38rem] h-[38rem] opacity-35 filter blur-[90px] animate-liquid-blob-reverse pointer-events-none"
        style={{
          background: "radial-gradient(circle at 70% 30%, rgba(0, 117, 255, 0.45) 0%, rgba(79, 70, 229, 0.35) 50%, rgba(147, 51, 234, 0.2) 80%, transparent 100%)",
        }}
      />

      {/* Gentle Cyan & Royal Indigo Liquid Glow (Bottom Center) */}
      <div 
        className="absolute -bottom-36 left-1/3 w-[42rem] h-[42rem] opacity-40 filter blur-[95px] animate-liquid-blob pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(0, 210, 255, 0.3) 0%, rgba(67, 56, 202, 0.25) 50%, rgba(240, 246, 255, 0.6) 80%, transparent 100%)",
        }}
      />

      {/* Prismatic Fluid Caustic Ripple Rings in Logo Azure & Purple */}
      <div 
        className="absolute top-[18%] right-[22%] w-[26rem] h-[26rem] rounded-full border border-blue-400/25 opacity-30 animate-water-ripple pointer-events-none"
      />
      <div 
        className="absolute top-[18%] right-[22%] w-[26rem] h-[26rem] rounded-full border border-purple-400/25 opacity-30 animate-water-ripple pointer-events-none"
        style={{ animationDelay: "1.1s" }}
      />

      {/* Subtle Micro-mesh Water Sheen Grid */}
      <div 
        className="absolute inset-0 opacity-[0.025] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#0A1C3C 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
    </div>
  );
};
