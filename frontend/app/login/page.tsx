"use client";

import React, { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Lock,
  Mail,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  ArrowLeft,
  Check,
  Cpu,
  RefreshCw,
  Sparkles,
  FileText,
  Zap,
} from "lucide-react";
import { BackgroundOrbs } from "@/components/layout/BackgroundOrbs";

export default function LoginPage() {
  const router = useRouter();

  // Mode: 'signin' | 'signup'
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");

  // Form states
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState("QA Lead");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [isAlreadyAuth, setIsAlreadyAuth] = useState(false);

  // Check if session auth is already active
  useEffect(() => {
    if (typeof window !== "undefined") {
      const hasAuthCookie = document.cookie.split("; ").some((c) => c.startsWith("uatlens_auth="));
      const hasUserSession = sessionStorage.getItem("uatlens_user");
      if (hasAuthCookie && hasUserSession) {
        setIsAlreadyAuth(true);
      }
    }
  }, []);

  // Left-side Interactive Tilt & Mouse Pos
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  // 3D tilt and specular reflection calculation
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setMousePos({ x, y });

    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const tiltX = (centerY - y) / 22;
    const tiltY = (x - centerX) / 22;
    setTilt({ x: tiltX, y: tiltY });
  };

  const handleMouseLeave = () => {
    setTilt({ x: 0, y: 0 });
  };

  // Click to create water ripples
  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    setRipples((prev) => [...prev.slice(-4), newRipple]);
  };

  // Store session and authenticate
  const applyAuthentication = (userEmail: string, userName: string, userRole: string) => {
    // Session cookie: no expires/max-age means deleted automatically when browser closes!
    document.cookie = "uatlens_auth=1; path=/; SameSite=Lax";
    const profile = {
      email: userEmail,
      name: userName,
      role: userRole,
      loginTime: new Date().toISOString(),
    };
    sessionStorage.setItem("uatlens_user", JSON.stringify(profile));
  };

  // Social login simulation
  const handleSocialLogin = (provider: "Google" | "GitHub") => {
    setIsLoading(true);
    const chosenEmail = provider === "Google" ? "alex.morgan@enterprise.io" : "alex-dev@github.enterprise";
    const chosenName = provider === "Google" ? "Alex Morgan" : "Alex Morgan (GitHub)";
    applyAuthentication(chosenEmail, chosenName, "QA Lead");

    setTimeout(() => {
      setIsLoading(false);
      setAuthSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 700);
    }, 600);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setIsLoading(true);

    const userName = name || email.split("@")[0].replace(".", " ") || "Alex Morgan";
    applyAuthentication(email, userName, role);

    // Liquid auth transition
    setTimeout(() => {
      setIsLoading(false);
      setAuthSuccess(true);
      setTimeout(() => {
        router.push("/");
      }, 700);
    }, 600);
  };

  return (
    <div className="relative min-h-screen flex flex-col justify-between overflow-x-hidden selection:bg-blue-100 selection:text-blue-900">
      <BackgroundOrbs />

      {/* Top Floating Glass Navigation with Official Logo */}
      <header className="relative z-20 w-full px-6 sm:px-12 py-4 flex items-center justify-between">
        <Link href="/" className="flex items-center space-x-3 group">
          <img
            src="/logo.png"
            alt="UATlens AI Logo"
            className="h-9 sm:h-11 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
          />
        </Link>

        {/* Header Right Status / Back Link */}
        {isAlreadyAuth ? (
          <Link
            href="/"
            className="liquid-glass-pill flex items-center space-x-2 px-4 py-2 text-xs font-semibold text-slate-700 hover:text-blue-700 transition-all cursor-pointer shadow-xs border border-blue-200/50"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>Enter Workspace</span>
          </Link>
        ) : (
          <div className="liquid-glass-pill flex items-center space-x-2 px-3.5 py-1.5 text-xs font-semibold text-slate-700 shadow-xs border border-blue-200/40">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[11px] text-slate-600 font-medium">Enterprise Security Guardrail</span>
          </div>
        )}
      </header>

      {/* Main Split Layout: Left Interactive Attraction | Right Liquid Account Form */}
      <main className="relative z-10 flex-1 max-w-7xl w-full mx-auto px-4 sm:px-8 py-4 sm:py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
        
        {/* ========================================================
            LEFT SIDE: HIGH-ATTRACTION INTERACTIVE LIQUID DESIGNS
           ======================================================== */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onClick={handleContainerClick}
          className="lg:col-span-7 flex flex-col justify-center space-y-6 relative cursor-pointer select-none"
        >
          {/* Dynamic Water Ripples Generated on Click */}
          {ripples.map((rip) => (
            <span
              key={rip.id}
              className="absolute pointer-events-none rounded-full border border-blue-400/40 animate-water-ripple"
              style={{
                left: rip.x,
                top: rip.y,
                width: "80px",
                height: "80px",
                marginLeft: "-40px",
                marginTop: "-40px",
              }}
            />
          ))}

          {/* Liquid Glass Badge */}
          <div className="inline-flex items-center space-x-2.5 px-4 py-1.5 rounded-full liquid-glass-pill self-start shadow-xs border border-blue-200/60">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-600 shadow-[0_0_8px_rgba(0,117,255,0.85)]"></span>
            </span>
            <span className="text-xs font-semibold text-slate-800 tracking-wide">
              Enterprise Acceptance Suite
            </span>
            <span className="text-slate-300">•</span>
            <span className="text-[11px] font-medium text-blue-700">Click anywhere to ripple</span>
          </div>

          {/* Headline Matching Logo Colors */}
          <div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
              Experience testing in <br />
              <span className="logo-gradient-text font-black">liquid clarity.</span>
            </h1>
            <p className="mt-4 text-base text-slate-600 max-w-xl font-normal leading-relaxed">
              Transform PRDs and complex user stories into zero-hallucination UAT cases. Verify requirements with deterministic certainty and effortless elegance.
            </p>
          </div>

          {/* 3D TILT INTERACTIVE LIQUID GLASS SHOWCASE CARD */}
          <div
            className="liquid-glass p-6 sm:p-8 rounded-[32px] relative overflow-hidden transition-transform duration-200 ease-out border border-white/90 shadow-2xl"
            style={{
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
            }}
          >
            {/* Liquid Specular Glint in Azure & Violet that follows mouse */}
            <div
              className="absolute pointer-events-none rounded-full blur-2xl opacity-30 transition-opacity duration-300"
              style={{
                left: mousePos.x - 120,
                top: mousePos.y - 120,
                width: "240px",
                height: "240px",
                background: "radial-gradient(circle, rgba(0, 117, 255, 0.6) 0%, rgba(124, 58, 237, 0.45) 50%, transparent 80%)",
              }}
            />

            {/* Minimalist Header with Status Glow */}
            <div className="flex items-center justify-between pb-4 border-b border-white/60">
              <div className="flex items-center space-x-2">
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-bold text-slate-800 tracking-wide uppercase">AI Test Engine</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-bold border border-blue-200/60 shadow-xs flex items-center space-x-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                <span>Zero Hallucination</span>
              </span>
            </div>

            {/* 3-Step Clean Visual Pipeline */}
            <div className="grid grid-cols-3 gap-3 my-5">
              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/90 text-center hover:bg-white/95 hover:shadow-md transition-all shadow-xs group">
                <div className="w-9 h-9 mx-auto rounded-xl bg-blue-100/80 text-blue-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <FileText className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-800">1. Input Specs</div>
                <div className="text-[10px] text-slate-500 mt-0.5">PRDs or Stories</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/90 text-center hover:bg-white/95 hover:shadow-md transition-all shadow-xs group">
                <div className="w-9 h-9 mx-auto rounded-xl bg-indigo-100/80 text-indigo-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <Cpu className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-800">2. AI Synthesis</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Rules & Edge Cases</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/70 border border-white/90 text-center hover:bg-white/95 hover:shadow-md transition-all shadow-xs group">
                <div className="w-9 h-9 mx-auto rounded-xl bg-purple-100/80 text-purple-600 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div className="text-xs font-bold text-slate-800">3. Verified UAT</div>
                <div className="text-[10px] text-slate-500 mt-0.5">Jira & Excel Ready</div>
              </div>
            </div>

            {/* Value Highlights in Clean Cards */}
            <div className="p-4 rounded-2xl bg-white/70 border border-white/90 space-y-2.5 shadow-xs">
              <div className="flex items-center space-x-3 text-xs text-slate-700">
                <div className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span><strong className="text-slate-900 font-semibold">100% Traceable:</strong> Every step links verbatim to requirements</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-slate-700">
                <div className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span><strong className="text-slate-900 font-semibold">Full Test Coverage:</strong> Positive, negative, boundary & timeout cases</span>
              </div>
              <div className="flex items-center space-x-3 text-xs text-slate-700">
                <div className="w-5 h-5 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 stroke-[3]" />
                </div>
                <span><strong className="text-slate-900 font-semibold">Instant Speed:</strong> Complete enterprise test suites in under 30 seconds</span>
              </div>
            </div>

            {/* Clean, High-Impact Stats */}
            <div className="grid grid-cols-3 gap-3 pt-4 mt-1 border-t border-white/50 text-center">
              <div className="p-2.5 rounded-2xl bg-white/60 border border-white/80">
                <span className="block text-xl font-black text-blue-600">&lt; 30s</span>
                <span className="text-[10px] text-slate-500 font-medium">Generation Time</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/60 border border-white/80">
                <span className="block text-xl font-black text-indigo-600">100%</span>
                <span className="text-[10px] text-slate-500 font-medium">Rule Traceability</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-white/60 border border-white/80">
                <span className="block text-xl font-black text-purple-600">0%</span>
                <span className="text-[10px] text-slate-500 font-medium">Hallucinations</span>
              </div>
            </div>
          </div>

          {/* Interactive Hint */}
          <div className="flex items-center space-x-3 text-xs text-slate-500 pt-1">
            <span className="flex h-2 w-2 rounded-full bg-blue-600" />
            <span>Interactive Liquid Surface: Move cursor to tilt card, click to emit water ripples.</span>
          </div>
        </div>

        {/* ========================================================
            RIGHT SIDE: LIQUID GLASS ACCOUNT LOGIN / REGISTER FORM
           ======================================================== */}
        <div className="lg:col-span-5">
          <div className="liquid-glass p-6 sm:p-9 rounded-[36px] border border-white shadow-2xl relative overflow-hidden backdrop-blur-3xl">
            {/* Top Liquid Shimmer Glow in Azure & Violet */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-blue-500/25 via-purple-500/20 to-transparent rounded-full filter blur-2xl pointer-events-none" />

            {/* Mode Switcher Liquid Pill */}
            <div className="p-1 rounded-full bg-slate-200/50 border border-white/80 flex items-center mb-6 relative">
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer relative z-10 ${
                  authMode === "signin"
                    ? "bg-white text-blue-900 shadow-md shadow-blue-900/10"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer relative z-10 ${
                  authMode === "signup"
                    ? "bg-white text-blue-900 shadow-md shadow-blue-900/10"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Create Account
              </button>
            </div>

            {/* Header Text */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {authMode === "signin" ? "Welcome back" : "Create your account"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {authMode === "signin"
                  ? "Enter your credentials to access your UAT test workspaces."
                  : "Join top QA and BA engineering teams crafting deterministic UAT suites."}
              </p>
            </div>


            {/* The Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name Field (Sign Up only) */}
              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                    <input
                      type="text"
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Alex Morgan"
                      className="w-full pl-10 pr-4 py-3 text-xs font-medium liquid-glass-input text-slate-800 placeholder-slate-400"
                    />
                  </div>
                </div>
              )}

              {/* Email Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="alex.morgan@enterprise.io"
                    className="w-full pl-10 pr-4 py-3 text-xs font-medium liquid-glass-input text-slate-800 placeholder-slate-400"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Password
                  </label>
                  {authMode === "signin" && (
                    <a href="#forgot" className="text-[11px] font-semibold text-blue-700 hover:underline">
                      Forgot?
                    </a>
                  )}
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-10 pr-10 py-3 text-xs font-medium liquid-glass-input text-slate-800 placeholder-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-3.5 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role Selection (Sign Up only) */}
              {authMode === "signup" && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-1.5">
                    Your Primary Role
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {["QA Lead", "Business Analyst", "Product Owner", "UAT Tester"].map((r) => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => setRole(r)}
                        className={`py-2 px-3 rounded-xl text-[11px] font-semibold transition-all cursor-pointer text-center ${
                          role === r
                            ? "bg-blue-600 text-white shadow-xs"
                            : "liquid-glass-pill text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Remember Me Checkbox */}
              {authMode === "signin" && (
                <div className="flex items-center space-x-2 pt-1">
                  <input
                    id="remember"
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                  />
                  <label htmlFor="remember" className="text-xs text-slate-600 cursor-pointer">
                    Remember my session on this device
                  </label>
                </div>
              )}

              {/* Submit Capsule Button with Logo Gradient and Liquid Shimmer */}
              <button
                type="submit"
                disabled={isLoading || authSuccess}
                className={`w-full py-3.5 px-6 rounded-full text-xs font-bold uppercase tracking-wider text-white transition-all flex items-center justify-center space-x-2 cursor-pointer relative overflow-hidden liquid-shimmer-effect ${
                  authSuccess
                    ? "bg-blue-600 shadow-blue-500/30"
                    : "logo-gradient-btn hover:scale-[1.01]"
                }`}
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Authorizing Session...</span>
                  </>
                ) : authSuccess ? (
                  <>
                    <Check className="w-4 h-4 text-white stroke-[3]" />
                    <span>Welcome! Entering Workspace...</span>
                  </>
                ) : (
                  <>
                    <span>{authMode === "signin" ? "Sign In to UATlens AI" : "Complete Registration"}</span>
                    <ArrowRight className="w-4 h-4 text-blue-100" />
                  </>
                )}
              </button>
            </form>

            {/* Social Authentication */}
            <div className="mt-6 pt-5 border-t border-slate-200/60">
              <span className="block text-center text-[11px] font-medium text-slate-400 mb-3">
                Or continue with enterprise single sign-on
              </span>
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={() => handleSocialLogin("Google")}
                  className="liquid-glass-pill flex items-center justify-center space-x-2 py-2.5 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer shadow-xs border border-blue-200/40"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                    />
                  </svg>
                  <span>Google</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSocialLogin("GitHub")}
                  className="liquid-glass-pill flex items-center justify-center space-x-2 py-2.5 px-3 text-xs font-semibold text-slate-700 hover:text-slate-900 cursor-pointer shadow-xs border border-purple-200/40"
                >
                  <svg className="w-4 h-4 fill-slate-800" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                  </svg>
                  <span>GitHub</span>
                </button>
              </div>
            </div>

            {/* Footer terms */}
            <div className="mt-5 text-center text-[10px] text-slate-400">
              By proceeding, you agree to our Enterprise Terms of Service and Deterministic Privacy Safeguards.
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center py-4 text-[11px] text-slate-400 border-t border-white/60">
        <span className="font-semibold text-slate-600">UATlens AI</span> — Liquid Glass Edition. AI drafts, system validates, human approves.
      </footer>
    </div>
  );
}
