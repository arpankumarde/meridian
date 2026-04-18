"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";

type Stage = "credentials" | "otp";

export default function TestLoginPage() {
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
      router.push("/dashboard");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Verification failed");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
          <CardDescription>
            {stage === "credentials"
              ? "Enter your email and password to receive an OTP."
              : "Enter the 6-digit OTP sent to your email."}
          </CardDescription>
        </CardHeader>
        {stage === "credentials" ? (
          <form onSubmit={submitCredentials}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="mt-4">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Sending…" : "Send OTP"}
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={submitOtp}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="code">OTP</Label>
                <Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
            </CardContent>
            <CardFooter className="mt-4 flex flex-col gap-2">
              <Button type="submit" disabled={loading || code.length !== 6} className="w-full">
                {loading ? "Verifying…" : "Verify & continue"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setStage("credentials");
                  setCode("");
                }}
                className="w-full"
              >
                Back
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
