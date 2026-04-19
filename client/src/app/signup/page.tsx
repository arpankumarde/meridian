"use client";

import Link from "next/link";
import Image from "next/image";
import { LuArrowLeft, LuCircleCheck } from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRazorpay } from "react-razorpay";
import { toast } from "sonner";
import { type CurrencyCode } from "react-razorpay/dist/constants/currency";

type SignupResponse = {
  userId: string;
  organizationId: string;
  subscriptionId: string;
  orderId: string;
  pgOrderId: string;
  amount: number;
  currency: string;
  key: string;
};

export default function SignupPage() {
  const router = useRouter();
  const { Razorpay } = useRazorpay();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
    password: "",
    orgName: "",
    orgDomain: "",
    orgLogo: "",
  });

  function update(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      // Auto-extract domain from email since the domain input field is omitted
      const derivedDomain = form.email.includes("@") ? form.email.split("@")[1] : "unknown.com";
      
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, orgDomain: form.orgDomain || derivedDomain }),
      });
      const data = (await res.json()) as SignupResponse | { error: string };
      if (!res.ok)
        throw new Error("error" in data ? data.error : "Signup failed");

      openCheckout(data as SignupResponse);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Signup failed");
      setLoading(false);
    }
  }

  function openCheckout(data: SignupResponse) {
    const rzp = new Razorpay({
      image:
        "https://raw.githubusercontent.com/arpankumarde/meridian/refs/heads/main/client/public/brand/logo.png",
      key: data.key,
      amount: data.amount,
      currency: data.currency as CurrencyCode,
      order_id: data.pgOrderId,
      name: "Meridian",
      description: `Quarterly subscription · ${form.orgName}`,
      prefill: { email: form.email },
      handler: async (response) => {
        try {
          const verify = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            }),
          });
          const body = await verify.json();
          if (!verify.ok) throw new Error(body.error ?? "Verification failed");
          toast.success("Payment captured — redirecting");
          localStorage.setItem("meridian_org_id", data.organizationId);
          router.push("/workspace");
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Verification failed",
          );
          setLoading(false);
        }
      },
      modal: {
        ondismiss: () => {
          toast.info("Payment cancelled");
          setLoading(false);
        },
      },
      theme: { color: "#06b6d4" },
    });

    rzp.on("payment.failed", (resp) => {
      toast.error(resp.error?.description ?? "Payment failed");
      setLoading(false);
    });

    rzp.open();
  }
  return (
    <div className="min-h-screen bg-void text-text selection:bg-cyan/20 selection:text-cyan flex">
      {/* Left Column - Content */}
      <div className="hidden lg:flex w-1/2 bg-surface border-r border-obs-border relative flex-col justify-between p-12 overflow-hidden">
        <div className="aurora opacity-40 pointer-events-none" />
        <div className="grain pointer-events-none" />
        
        {/* Grid Background */}
        <div className="absolute inset-0 pointer-events-none z-0">
           <div className="w-full h-full border-x border-obs-border/30 mx-8 relative">
              <div className="absolute top-1/4 left-0 w-full h-px bg-obs-border/30" />
              <div className="absolute top-3/4 left-0 w-full h-px bg-obs-border/30" />
           </div>
        </div>

        <div className="relative z-10 animate-rise">
           <Link href="/" className="inline-block group mb-16">
              <div className="flex items-center gap-2 text-[11px] font-mono font-bold uppercase tracking-widest text-text-muted hover:text-cyan transition-colors mb-6">
                <LuArrowLeft className="group-hover:-translate-x-1 transition-transform" />
                Back to Home
              </div>
              <Image src="/brand/logo.png" alt="Meridian" width={140} height={40} className="h-8 w-auto object-contain" />
           </Link>

           <h2 className="font-section text-3xl md:text-5xl text-text leading-[1.1] tracking-tight mb-6">
              Join the<br />Network.
           </h2>
           <p className="font-sub text-text-secondary max-w-md text-lg">
              Unlock confidence-scored landscapes with full citation trails across your workflows.
           </p>

           <ul className="mt-12 space-y-4 font-mono text-[13px]">
              <li className="flex items-center gap-3 text-text-muted">
                 <LuCircleCheck className="text-cyan text-lg" />
                 Uncover scientific white space
              </li>
              <li className="flex items-center gap-3 text-text-muted">
                 <LuCircleCheck className="text-cyan text-lg" />
                 Integrate with Google Docs &amp; PDF workflows
              </li>
              <li className="flex items-center gap-3 text-text-muted">
                 <LuCircleCheck className="text-cyan text-lg" />
                 Secure, private, enterprise-grade analysis
              </li>
           </ul>
        </div>

        <div className="relative z-10 mt-auto pt-8 border-t border-obs-border/50 animate-rise opacity-0 [animation-delay:200ms]">
           <div className="flex items-center gap-3">
              <span className="flex h-2 w-2 rounded-full bg-cyan animate-pulse" />
              <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-text-muted">
                System Operational · Node <span className="text-cyan">US-EAST</span>
              </p>
           </div>
        </div>
      </div>

      {/* Right Column - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center items-center p-6 relative">
         <div className="w-full max-w-md animate-rise opacity-0 [animation-delay:100ms] py-8">
            
            {/* Mobile Header (Hidden on Desktop) */}
            <div className="lg:hidden flex flex-col items-center mb-10 text-center">
              <Image src="/brand/logo.png" alt="Meridian" width={120} height={34} className="h-7 w-auto object-contain mb-8" />
              <h1 className="font-section text-2xl text-text mb-2 tracking-tight">Join Meridian</h1>
              <p className="font-sub text-[13px] text-text-secondary">Request access to the enterprise R&amp;D intelligence platform</p>
            </div>

            {/* Desktop Header */}
            <div className="hidden lg:block mb-10">
              <h1 className="font-section text-3xl text-text mb-2 tracking-tight">Request Access</h1>
              <p className="font-sub text-[15px] text-text-secondary">Join Meridian's enterprise R&amp;D intelligence platform</p>
            </div>

            <form className="flex flex-col gap-4" onSubmit={onSubmit}>
              <div className="flex flex-col gap-2">
                <Label htmlFor="orgName" className="font-sans text-xs uppercase tracking-widest text-text-secondary">Organization Name</Label>
                <Input id="orgName" placeholder="Acme Corp" className="h-11 obs-input text-[15px]" value={form.orgName} onChange={update("orgName")} required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="email" className="font-sans text-xs uppercase tracking-widest text-text-secondary">Work Email</Label>
                <Input id="email" type="email" placeholder="jane@company.com" className="h-11 obs-input text-[15px]" value={form.email} onChange={update("email")} required />
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="password" className="font-sans text-xs uppercase tracking-widest text-text-secondary">Password</Label>
                <Input id="password" type="password" placeholder="••••••••" className="h-11 obs-input text-[15px]" value={form.password} onChange={update("password")} required minLength={6} />
              </div>

              <Button type="submit" disabled={loading} className="h-12 w-full bg-cyan hover:bg-cyan-hover text-white font-bold uppercase tracking-widest text-[13px] mt-4 transition-colors relative overflow-hidden group">
                <span className="relative z-10 transition-transform group-hover:translate-x-1 inline-block">{loading ? "Processing…" : "Create & Pay ₹24,999"}</span>
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out" />
              </Button>
            </form>

            <div className="mt-10 pt-6 text-center">
              <p className="text-[13px] text-text-secondary">
                Already have an account?{" "}
                <Link href="/login" className="font-bold text-cyan hover:text-amber hover:underline underline-offset-4 transition-colors">
                  Sign In
                </Link>
              </p>
            </div>
         </div>
      </div>
    </div>
  );
}
