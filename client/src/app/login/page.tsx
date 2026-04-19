"use client";

import Link from "next/link";
import Image from "next/image";
import { LuArrowLeft, LuCircleCheck } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

type Stage = "credentials" | "otp";

export default function LoginPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("credentials");
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  async function submitCredentials(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Login failed");
      setUserId(body.userId);
      setStage("otp");
      if (body.devOtp) toast.info(`Dev OTP: ${body.devOtp}`);
      else toast.success("OTP sent to your email");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setLoading(true);
    try {
      const res = await fetch("/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, code, purpose: "LOGIN" }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Verification failed");
      toast.success("Verified — redirecting");
      if (body.organizationId) {
        localStorage.setItem("meridian_org_id", body.organizationId);
      }
      router.push("/workspace");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      setLoading(false);
    }
  }
  return (
    <div className="min-h-screen bg-void text-text selection:bg-amber/20 selection:text-amber flex">
      {/* Left Column - Content */}
      <div className="hidden lg:flex w-1/2 bg-surface border-r border-obs-border relative flex-col justify-between p-12 overflow-hidden">
        <div className="aurora opacity-40 pointer-events-none" />
        <div className="grain pointer-events-none" />
        
        {/* Grid Background */}
        <div className="absolute inset-0 pointer-events-none z-0">
           <div className="w-full h-full border-x border-obs-border/30 mx-8 relative">
              <div className="absolute top-1/3 left-0 w-full h-px bg-obs-border/30" />
              <div className="absolute top-2/3 left-0 w-full h-px bg-obs-border/30" />
           </div>
        </div>

        <div className="relative z-10 animate-rise">
           <Link href="/" className="inline-block group mb-16">
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted hover:text-amber transition-colors mb-6">
                <LuArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                Back to Home
              </div>
              <Image src="/brand/logo.png" alt="Meridian" width={140} height={40} className="h-8 w-auto object-contain" />
           </Link>

           <h2 className="font-section text-3xl md:text-5xl text-text leading-[1.1] tracking-tight mb-6">
              Enterprise R&amp;D<br />Intelligence.
           </h2>
           <p className="font-sub text-text-secondary max-w-md text-lg">
              Connect your internal corpus to global literature, patents, standards, and filings.
           </p>

           <ul className="mt-12 space-y-4 font-mono text-[13px]">
              <li className="flex items-center gap-3 text-text-muted">
                 <LuCircleCheck className="text-emerald text-lg" />
                 Cross-corpus knowledge graph
              </li>
              <li className="flex items-center gap-3 text-text-muted">
                 <LuCircleCheck className="text-emerald text-lg" />
                 Confidence-scored landscapes
              </li>
              <li className="flex items-center gap-3 text-text-muted">
                 <LuCircleCheck className="text-emerald text-lg" />
                 Contradiction and prior-art detection
              </li>
           </ul>
        </div>

        <div className="relative z-10 mt-auto pt-8 border-t border-obs-border/50 animate-rise opacity-0 [animation-delay:200ms]">
           <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-amber animate-pulse" />
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted">
                System Operational · Node <span className="text-amber">US-EAST</span>
              </p>
           </div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 relative">
         <div className="w-full max-w-md animate-rise opacity-0 [animation-delay:100ms]">
            
            {/* Mobile Header (Hidden on Desktop) */}
            <div className="lg:hidden flex flex-col items-center mb-10 text-center">
              <Image src="/brand/logo.png" alt="Meridian" width={120} height={34} className="h-7 w-auto object-contain mb-8" />
              <h1 className="font-section text-2xl text-text mb-2 tracking-tight">
                {stage === "credentials" ? "Welcome Back" : "Verify OTP"}
              </h1>
              <p className="font-sub text-sm text-text-secondary">
                {stage === "credentials" ? "Enter your credentials to access your workspace" : "Enter the 6-digit OTP sent to your email."}
              </p>
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:block mb-10">
              <h1 className="font-section text-3xl text-text mb-2 tracking-tight">
                {stage === "credentials" ? "Welcome Back" : "Verify OTP"}
              </h1>
              <p className="font-sub text-[15px] text-text-secondary">
                {stage === "credentials" ? "Enter your credentials to access your workspace" : "Enter the 6-digit OTP sent to your email."}
              </p>
            </div>

            {stage === "credentials" ? (
              <form className="flex flex-col gap-5" onSubmit={submitCredentials}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="email" className="font-sans text-xs uppercase tracking-widest text-text-secondary">Email</Label>
                  <Input id="email" type="email" placeholder="you@company.com" className="h-12 obs-input text-[15px]" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                
                <div className="flex flex-col gap-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" className="font-sans text-xs uppercase tracking-widest text-text-secondary">Password</Label>
                    <Link href="#" className="text-[11px] font-mono font-bold text-amber hover:text-amber-hover transition-colors">Forgot?</Link>
                  </div>
                  <Input id="password" type="password" placeholder="••••••••" className="h-12 obs-input text-[15px]" value={password} onChange={(e) => setPassword(e.target.value)} required />
                </div>

                <Button type="submit" disabled={loading} className="h-12 w-full bg-amber hover:bg-amber-hover text-white font-bold uppercase tracking-widest text-[13px] mt-4 transition-colors relative overflow-hidden group">
                  <span className="relative z-10 transition-transform group-hover:translate-x-1 inline-block">{loading ? "Sending…" : "Sign In"}</span>
                  <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                </Button>
              </form>
            ) : (
              <form className="flex flex-col gap-5" onSubmit={submitOtp}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="code" className="font-sans text-xs uppercase tracking-widest text-text-secondary">OTP</Label>
                  <Input id="code" inputMode="numeric" maxLength={6} placeholder="123456" className="h-12 obs-input text-[15px]" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required />
                </div>

                <div className="flex flex-col gap-3 mt-4">
                  <Button type="submit" disabled={loading || code.length !== 6} className="h-12 w-full bg-amber hover:bg-amber-hover text-white font-bold uppercase tracking-widest text-[13px] transition-colors relative overflow-hidden group">
                    <span className="relative z-10 transition-transform group-hover:translate-x-1 inline-block">{loading ? "Verifying…" : "Verify & Continue"}</span>
                    <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => { setStage("credentials"); setCode(""); }} className="h-12 w-full font-bold uppercase tracking-widest text-[13px] text-text-secondary hover:text-text transition-colors">
                    Back
                  </Button>
                </div>
              </form>
            )}

            <div className="mt-10 pt-6 text-center">
              <p className="text-[13px] text-text-secondary">
                Don't have an account?{" "}
                <Link href="/signup" className="font-bold text-amber hover:text-cyan hover:underline underline-offset-4 transition-colors">
                  Request Access
                </Link>
              </p>
            </div>
         </div>
      </div>
    </div>
  );
}
