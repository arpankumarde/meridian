"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useRazorpay } from "react-razorpay";
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

export default function TestCreatePage() {
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
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
          router.push("/dashboard");
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
      theme: { color: "#0f172a" },
    });

    rzp.on("payment.failed", (resp) => {
      toast.error(resp.error?.description ?? "Payment failed");
      setLoading(false);
    });

    rzp.open();
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-muted/30">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Create account</CardTitle>
          <CardDescription>
            Set up your organization and complete payment to continue.
          </CardDescription>
        </CardHeader>
        <form onSubmit={onSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="orgName">Organization name</Label>
              <Input
                id="orgName"
                value={form.orgName}
                onChange={update("orgName")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgDomain">Organization domain</Label>
              <Input
                id="orgDomain"
                placeholder="acme.com"
                value={form.orgDomain}
                onChange={update("orgDomain")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="orgLogo">Logo URL (optional)</Label>
              <Input
                id="orgLogo"
                value={form.orgLogo}
                onChange={update("orgLogo")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={update("email")}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={form.password}
                onChange={update("password")}
                required
                minLength={6}
              />
            </div>
          </CardContent>
          <CardFooter className="mt-4">
            <Button type="submit" disabled={loading} className="w-full">
              {loading ? "Processing…" : "Create & Pay ₹24,999"}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
