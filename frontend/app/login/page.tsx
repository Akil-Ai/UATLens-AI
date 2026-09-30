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
  AlertCircle,
  Info,
} from "lucide-react";
import { BackgroundOrbs } from "@/components/layout/BackgroundOrbs";
import { supabase, setAuthCookies } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  // Mode: 'signin' | 'signup' | 'forgot'
  const [authMode, setAuthMode] = useState<"signin" | "signup" | "forgot">("signin");

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [oauthNotice, setOauthNotice] = useState<string | null>(null);

  // Check if real Supabase session is already active
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session) {
          setIsAlreadyAuth(true);
          setAuthCookies(data.session.access_token, data.session.refresh_token);
        }
      } catch (err) {
        console.error("Session check failed", err);
      }
    }
    checkExistingSession();
  }, []);

  // Left-side Interactive Tilt & Mouse Pos
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [ripples, setRipples] = useState<{ id: number; x: number; y: number }[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);

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

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const newRipple = { id: Date.now(), x, y };
    setRipples((prev) => [...prev.slice(-4), newRipple]);
  };

  // Google / GitHub OAuth click handler (displays honest configuration status)
  const handleSocialLogin = async (provider: "Google" | "GitHub") => {
    setErrorMessage(null);
    setInfoMessage(null);
    setOauthNotice(
      `${provider} OAuth is not enabled in this Supabase project. Please sign in or register with your email and password.`
    );
  };

  // Real Supabase Authentication Submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setInfoMessage(null);
    setOauthNotice(null);

    if (!email) {
      setErrorMessage("Please enter your work email.");
      return;
    }

    if (authMode === "forgot") {
      setIsLoading(true);
      try {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
        });
        setIsLoading(false);
        if (error) {
          setErrorMessage(error.message);
        } else {
          setInfoMessage("Password reset email sent! Please check your inbox for recovery instructions.");
        }
      } catch (err: any) {
        setIsLoading(false);
        setErrorMessage(err.message || "Failed to send reset email.");
      }
      return;
    }

    if (!password) {
      setErrorMessage("Please enter your password.");
      return;
    }

    setIsLoading(true);

    if (authMode === "signin") {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          setIsLoading(false);
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          setAuthCookies(data.session.access_token, data.session.refresh_token);
          sessionStorage.setItem(
            "uatlens_user",
            JSON.stringify({
              id: data.user?.id,
              email: data.user?.email,
              name: data.user?.user_metadata?.name || email.split("@")[0],
              role: data.user?.user_metadata?.role || "QA Lead",
              loginTime: new Date().toISOString(),
            })
          );
          setIsLoading(false);
          setAuthSuccess(true);
          setTimeout(() => {
            window.location.href = "/";
          }, 400);
        } else {
          setIsLoading(false);
          setErrorMessage(
            "Login succeeded, but your email has not been confirmed yet. Please verify your email or disable confirmation in Supabase."
          );
          return;
        }
      } catch (err: any) {
        setIsLoading(false);
        setErrorMessage(err.message || "An unexpected error occurred during sign in.");
      }
    } else if (authMode === "signup") {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              name: name || email.split("@")[0],
              role,
            },
          },
        });

        if (error) {
          setIsLoading(false);
          setErrorMessage(error.message);
          return;
        }

        setIsLoading(false);

        if (data.session) {
          setAuthCookies(data.session.access_token, data.session.refresh_token);
          sessionStorage.setItem(
            "uatlens_user",
            JSON.stringify({
              id: data.user?.id,
              email: data.user?.email,
              name: name || email.split("@")[0],
              role,
              loginTime: new Date().toISOString(),
            })
          );
          setAuthSuccess(true);
          setTimeout(() => {
            window.location.href = "/";
          }, 400);
        } else {
          // Email confirmation required
          setInfoMessage(
            "Registration submitted! If email confirmation is enabled in your project, please verify your email before signing in."
          );
          setAuthMode("signin");
        }
      } catch (err: any) {
        setIsLoading(false);
        setErrorMessage(err.message || "An unexpected error occurred during registration.");
      }
    }
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
            <span className="text-[11px] text-slate-600 font-medium">Enterprise Supabase Auth Active</span>
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
            style={{
              transform: `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg)`,
              transition: "transform 0.15s ease-out",
            }}
            className="liquid-glass p-6 sm:p-7 rounded-[32px] border border-white/90 shadow-2xl relative overflow-hidden backdrop-blur-2xl"
          >
            {/* Top Interactive Specular Sheen */}
            <div
              className="absolute inset-0 pointer-events-none rounded-[32px] opacity-40 transition-opacity duration-300"
              style={{
                background: `radial-gradient(circle 350px at ${mousePos.x}px ${mousePos.y}px, rgba(255,255,255,0.85), transparent 70%)`,
              }}
            />

            {/* Header info */}
            <div className="flex items-center justify-between pb-4 border-b border-blue-100/60 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Deterministic UAT Engine</h2>
                  <p className="text-[11px] text-slate-500">Five-Stage Verification Pipeline</p>
                </div>
              </div>
              <span className="liquid-glass-pill px-3 py-1 text-[11px] font-bold text-blue-700 border border-blue-200/50">
                Active Project
              </span>
            </div>

            {/* Metric pill row */}
            <div className="grid grid-cols-3 gap-3 my-5 relative z-10">
              <div className="liquid-glass p-3 rounded-2xl text-center border border-white/70">
                <span className="block text-[11px] font-medium text-slate-500">Strict Traceability</span>
                <span className="text-lg font-extrabold text-blue-900">100%</span>
              </div>
              <div className="liquid-glass p-3 rounded-2xl text-center border border-white/70">
                <span className="block text-[11px] font-medium text-slate-500">Permission Rules</span>
                <span className="text-lg font-extrabold text-purple-900">Verified</span>
              </div>
              <div className="liquid-glass p-3 rounded-2xl text-center border border-white/70">
                <span className="block text-[11px] font-medium text-slate-500">Hallucinations</span>
                <span className="text-lg font-extrabold text-emerald-600">Zero</span>
              </div>
            </div>

            {/* Simulated Test Output Row */}
            <div className="space-y-2 relative z-10">
              <div className="p-3 rounded-xl bg-white/70 border border-blue-100/60 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span className="font-semibold text-slate-800">TC-001: Cart quantity boundary</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                  Approved
                </span>
              </div>
              <div className="p-3 rounded-xl bg-white/70 border border-blue-100/60 flex items-center justify-between text-xs">
                <div className="flex items-center space-x-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-600 shrink-0" />
                  <span className="font-semibold text-slate-800">PR-001: Only Admin can approve refunds</span>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-800">
                  Allowed
                </span>
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
            {authMode !== "forgot" && (
              <div className="p-1 rounded-full bg-slate-200/50 border border-white/80 flex items-center mb-6 relative">
                <button
                  type="button"
                  onClick={() => {
                    setAuthMode("signin");
                    setErrorMessage(null);
                    setInfoMessage(null);
                    setOauthNotice(null);
                  }}
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
                  onClick={() => {
                    setAuthMode("signup");
                    setErrorMessage(null);
                    setInfoMessage(null);
                    setOauthNotice(null);
                  }}
                  className={`flex-1 py-2 rounded-full text-xs font-bold transition-all cursor-pointer relative z-10 ${
                    authMode === "signup"
                      ? "bg-white text-blue-900 shadow-md shadow-blue-900/10"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Create Account
                </button>
              </div>
            )}

            {/* Header Text */}
            <div className="mb-6">
              <h2 className="text-2xl font-bold tracking-tight text-slate-900">
                {authMode === "signin"
                  ? "Welcome back"
                  : authMode === "signup"
                  ? "Create your account"
                  : "Reset your password"}
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {authMode === "signin"
                  ? "Enter your credentials to access your UAT test workspaces."
                  : authMode === "signup"
                  ? "Join top QA and BA engineering teams crafting deterministic UAT suites."
                  : "Enter your email address to receive password recovery instructions."}
              </p>
            </div>

            {/* Status Messages */}
            {errorMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-rose-50/80 border border-rose-200/80 flex items-start space-x-2.5 text-xs text-rose-800">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{errorMessage}</span>
              </div>
            )}

            {infoMessage && (
              <div className="mb-4 p-3 rounded-2xl bg-emerald-50/80 border border-emerald-200/80 flex items-start space-x-2.5 text-xs text-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{infoMessage}</span>
              </div>
            )}

            {oauthNotice && (
              <div className="mb-4 p-3 rounded-2xl bg-amber-50/80 border border-amber-200/80 flex items-start space-x-2.5 text-xs text-amber-800">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span className="leading-relaxed">{oauthNotice}</span>
              </div>
            )}

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

              {/* Password Field (signin / signup only) */}
              {authMode !== "forgot" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Password
                    </label>
                    {authMode === "signin" && (
                      <button
                        type="button"
                        onClick={() => {
                          setAuthMode("forgot");
                          setErrorMessage(null);
                          setInfoMessage(null);
                          setOauthNotice(null);
                        }}
                        className="text-[11px] font-semibold text-blue-700 hover:underline cursor-pointer"
                      >
                        Forgot?
                      </button>
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
              )}

              {/* Role Selection (Sign Up only) */}
              {authMode === "signup" && (
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Requirement Review Persona
                    </label>
                    <span className="text-[10px] text-slate-400">Separate from app permissions</span>
                  </div>
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

              {/* Forgot password back link */}
              {authMode === "forgot" && (
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthMode("signin");
                      setErrorMessage(null);
                      setInfoMessage(null);
                    }}
                    className="text-xs font-semibold text-blue-700 hover:underline flex items-center space-x-1 cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to sign in</span>
                  </button>
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
                    <span>
                      {authMode === "signin"
                        ? "Sign In to UATlens AI"
                        : authMode === "signup"
                        ? "Complete Registration"
                        : "Send Password Reset Link"}
                    </span>
                    <ArrowRight className="w-4 h-4 text-blue-100" />
                  </>
                )}
              </button>
            </form>

            {/* Social Authentication */}
            {authMode !== "forgot" && (
              <div className="mt-6 pt-5 border-t border-slate-200/60">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-medium text-slate-400">
                    Enterprise single sign-on
                  </span>
                  <span className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-medium">
                    OAuth Unconfigured
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleSocialLogin("Google")}
                    title="Google OAuth is not configured in Supabase settings"
                    className="liquid-glass-pill flex items-center justify-center space-x-2 py-2.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer shadow-xs border border-blue-200/40 opacity-80 hover:opacity-100"
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
                    title="GitHub OAuth is not configured in Supabase settings"
                    className="liquid-glass-pill flex items-center justify-center space-x-2 py-2.5 px-3 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer shadow-xs border border-purple-200/40 opacity-80 hover:opacity-100"
                  >
                    <svg className="w-4 h-4 fill-slate-800" viewBox="0 0 24 24">
                      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
                    </svg>
                    <span>GitHub</span>
                  </button>
                </div>
              </div>
            )}

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
