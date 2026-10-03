"use client";

import React from "react";

export const BackgroundOrbs: React.FC = () => {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-[#FFFFFF]" aria-hidden="true">
      {/* Morphing Liquid Droplet 1: Deep Orange & Amber Glow (Right) */}
      <div 
        className="absolute -top-[16rem] right-[-6rem] w-[46rem] h-[46rem] opacity-30 filter blur-[80px] animate-liquid-blob pointer-events-none"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(255, 140, 66, 0.5) 0%, rgba(255, 87, 34, 0.4) 45%, rgba(230, 74, 25, 0.2) 80%, transparent 100%)",
        }}
      />

      {/* Morphing Liquid Droplet 2: Soft Orange (Left Center) */}
      <div 
        className="absolute top-[25%] -left-36 w-[38rem] h-[38rem] opacity-20 filter blur-[90px] animate-liquid-blob-reverse pointer-events-none"
        style={{
          background: "radial-gradient(circle at 70% 30%, rgba(255, 140, 66, 0.3) 0%, rgba(255, 112, 67, 0.25) 50%, rgba(255, 87, 34, 0.1) 80%, transparent 100%)",
        }}
      />

      {/* Subtle Amber Liquid Glow (Bottom Center) */}
      <div 
        className="absolute -bottom-36 left-1/3 w-[42rem] h-[42rem] opacity-25 filter blur-[95px] animate-liquid-blob pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255, 204, 128, 0.3) 0%, rgba(255, 140, 66, 0.2) 50%, rgba(255, 255, 255, 0.4) 80%, transparent 100%)",
        }}
      />

      {/* Prismatic Fluid Caustic Ripple Rings in Orange */}
      <div 
        className="absolute top-[18%] right-[22%] w-[26rem] h-[26rem] rounded-full border border-orange-400/30 opacity-30 animate-water-ripple pointer-events-none"
      />
      <div 
        className="absolute top-[18%] right-[22%] w-[26rem] h-[26rem] rounded-full border border-amber-400/25 opacity-30 animate-water-ripple pointer-events-none"
        style={{ animationDelay: "1.1s" }}
      />

      {/* Subtle Micro-mesh Water Sheen Grid for Light Theme */}
      <div 
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `radial-gradient(#0A1C3C 1px, transparent 1px)`,
          backgroundSize: "28px 28px",
        }}
      />
    </div>
  );
};
