"use client";

import { useEffect, useState } from "react";
import {
  LuArrowRight,
  LuLoader,
  LuCircleAlert,
  LuPrinter,
  LuReceipt,
} from "react-icons/lu";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Subscription {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
}

interface Payment {
  id: string;
  pgPaymentId: string;
  method: string | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  order: {
    pgOrderId: string;
    receipt: string | null;
    gateway: string;
  } | null;
}

interface BillingResponse {
  organization: { id: string; name: string };
  subscription: Subscription | null;
  payments: Payment[];
}

const PLAN_LABELS: Record<string, string> = {
  QUARTERLY: "Enterprise Pro (Quarterly)",
  MONTHLY: "Enterprise (Monthly)",
  ANNUAL: "Enterprise Pro (Annual)",
};

function formatAmount(amountPaise: number, currency: string) {
  const value = amountPaise / 100;
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const MERIDIAN = {
  name: "Meridian",
  tagline: "Enterprise R&D Intelligence",
  website: "meridian.ai",
  support: "support@meridian.ai",
  address: "Meridian Labs, Bengaluru, India",
};

function printReceipt(payment: Payment, orgName: string) {
  const amount = formatAmount(payment.amount, payment.currency);
  const gateway = payment.order?.gateway ?? "—";
  const w = window.open("", "_blank", "width=720,height=900");
  if (!w) return;
  const html = `<!doctype html>
<html><head><title>Receipt ${payment.pgPaymentId}</title>
<style>
  body{font-family:ui-sans-serif,system-ui,sans-serif;color:#111;padding:48px;max-width:640px;margin:0 auto}
  h1{font-size:20px;margin:0 0 4px;letter-spacing:.02em}
  h2{font-size:13px;margin:32px 0 8px;letter-spacing:.15em;text-transform:uppercase;color:#666;font-weight:700}
  .muted{color:#666;font-size:12px}
  .row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #eee;font-size:13px;gap:16px}
  .row .k{color:#666;text-transform:uppercase;letter-spacing:.1em;font-size:10px;font-weight:700}
  .row .v{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;text-align:right;word-break:break-all}
  .total{margin-top:24px;display:flex;justify-content:space-between;font-weight:700;font-size:16px}
  .status{display:inline-block;padding:2px 8px;border-radius:999px;background:#f0fdf4;color:#16a34a;font-size:10px;font-weight:700;letter-spacing:.1em;text-transform:uppercase}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;padding-bottom:20px;border-bottom:2px solid #111}
  .brand-name{font-size:22px;font-weight:800;letter-spacing:.08em;text-transform:uppercase}
  .brand-meta{font-size:11px;color:#666;margin-top:4px;line-height:1.6}
  .foot{margin-top:40px;padding-top:20px;border-top:1px solid #eee;text-align:center;color:#888;font-size:11px;line-height:1.7}
</style></head>
<body>
  <div class="hdr">
    <div>
      <div class="brand-name">${MERIDIAN.name}</div>
      <div class="brand-meta">
        ${MERIDIAN.tagline}<br/>
        ${MERIDIAN.website} &middot; ${MERIDIAN.support}<br/>
        ${MERIDIAN.address}
      </div>
    </div>
    <span class="status">${payment.status}</span>
  </div>

  <h1 style="margin-top:24px">Payment Receipt</h1>
  <div class="muted">Billed to ${orgName}</div>

  <h2>Transaction</h2>
  <div class="row"><span class="k">Payment ID</span><span class="v">${payment.pgPaymentId}</span></div>
  <div class="row"><span class="k">Order ID</span><span class="v">${payment.order?.pgOrderId ?? "—"}</span></div>
  ${payment.order?.receipt ? `<div class="row"><span class="k">Receipt</span><span class="v">${payment.order.receipt}</span></div>` : ""}
  <div class="row"><span class="k">Gateway</span><span class="v">${gateway}</span></div>
  <div class="row"><span class="k">Method</span><span class="v">${payment.method ?? "—"}</span></div>
  <div class="row"><span class="k">Date</span><span class="v">${formatDateTime(payment.createdAt)}</span></div>
  <div class="total"><span>Total Paid</span><span>${amount}</span></div>

  <div class="foot">
    Thank you for choosing ${MERIDIAN.name}.<br/>
    Questions about this receipt? Contact ${MERIDIAN.support}.
  </div>
</body></html>`;
  w.document.write(html);
  w.document.close();
  w.focus();
  setTimeout(() => {
    w.print();
  }, 200);
}

export default function BillingPage() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [orgMissing, setOrgMissing] = useState(false);

  useEffect(() => {
    const orgId = localStorage.getItem("meridian_org_id");
    if (!orgId) {
      setOrgMissing(true);
      setLoading(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch(`/api/organizations/${orgId}/billing`);
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || "Failed to load billing");
        }
        setData(await res.json());
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not load billing"
        );
        console.error("[BillingPage] load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
        <div className="p-20 flex flex-col items-center justify-center text-text-muted">
          <LuLoader className="text-3xl animate-spin mb-4" />
          <p className="font-mono text-[11px] uppercase tracking-[0.2em]">
            Loading Billing...
          </p>
        </div>
      </div>
    );
  }

  if (orgMissing) {
    return (
      <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
        <div className="p-20 flex flex-col items-center justify-center text-center">
          <LuCircleAlert className="text-3xl text-text-muted mb-4" />
          <h3 className="text-lg font-semibold text-text mb-2">
            No organization selected
          </h3>
          <p className="text-sm text-text-secondary max-w-xs">
            Sign in and initialize a workspace to view billing.
          </p>
        </div>
      </div>
    );
  }

  const sub = data?.subscription ?? null;
  const payments = data?.payments ?? [];
  const orgName = data?.organization.name ?? "Organization";
  const planLabel = sub ? PLAN_LABELS[sub.plan] ?? sub.plan : "No active plan";
  const statusLabel = sub?.status ?? "INACTIVE";
  const renewalDate = formatDate(sub?.endsAt);
  const amountDisplay = sub
    ? formatAmount(sub.amount, sub.currency)
    : null;

  return (
    <div className="w-full max-w-7xl mx-auto px-6 py-12 animate-rise">
      <div className="mb-12">
        <h2 className="text-3xl font-display font-semibold mb-2">
          Billing & Subscription
        </h2>
        <p className="text-text-secondary text-sm">
          Manage your enterprise plan and usage limits.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-16 items-start">
        <div className="lg:col-span-5 p-8 bg-white border border-obs-border rounded-2xl shadow-sm relative overflow-hidden">
          <div className="aurora opacity-10" />
          <div className="relative z-10 mb-10">
            <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber mb-2">
              Current Plan
            </p>
            <h3 className="text-2xl font-display font-bold text-text">
              {planLabel}
            </h3>
            {amountDisplay && (
              <p className="text-xs text-text-secondary font-mono mt-2">
                {amountDisplay} / {sub?.plan.toLowerCase()}
              </p>
            )}

            <div className="mt-8 pt-6 border-t border-obs-border/60 grid grid-cols-2 gap-4">
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted mb-2">
                  Renewal
                </p>
                <p className="text-sm font-semibold text-text">{renewalDate}</p>
              </div>
              <div>
                <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-text-muted mb-2">
                  Status
                </p>
                <p
                  className={`text-[11px] font-mono font-bold uppercase tracking-widest ${
                    statusLabel === "ACTIVE" ? "text-emerald" : "text-amber"
                  }`}
                >
                  {statusLabel}
                </p>
              </div>
            </div>
          </div>

          <Button
            className="w-full h-12 gap-2 text-[13px] font-bold uppercase tracking-widest relative z-10 group bg-text hover:bg-black text-white"
            disabled={!sub}
          >
            {sub?.status === "ACTIVE" ? "Manage Subscription" : "Upgrade Subscription"}
            <LuArrowRight className="group-hover:translate-x-1 transition-transform" />
          </Button>
        </div>

        <div className="lg:col-span-7">
          <div className="flex items-center gap-3 mb-6">
            <LuReceipt className="text-xl text-text-muted" />
            <h3 className="text-lg font-display font-semibold">Transactions</h3>
          </div>

          <div className="bg-white border border-obs-border rounded-2xl shadow-sm overflow-hidden">
          {payments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-text-secondary">No transactions yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-obs-border">
              <div className="hidden md:grid grid-cols-12 gap-4 px-6 py-3 bg-surface text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-text-muted">
                <div className="col-span-3">Date</div>
                <div className="col-span-4">Payment ID</div>
                <div className="col-span-2">Gateway</div>
                <div className="col-span-2 text-right">Amount</div>
                <div className="col-span-1 text-right">Receipt</div>
              </div>
              {payments.map((p) => {
                const isSuccess =
                  p.status === "CAPTURED" || p.status === "AUTHORIZED";
                return (
                  <div
                    key={p.id}
                    className="grid grid-cols-1 md:grid-cols-12 gap-3 md:gap-4 px-6 py-4 items-center hover:bg-surface/50 transition-colors"
                  >
                    <div className="md:col-span-3">
                      <p className="text-sm font-semibold text-text">
                        {formatDate(p.createdAt)}
                      </p>
                      <p className="text-[10px] font-mono uppercase tracking-widest mt-0.5">
                        <span
                          className={
                            isSuccess ? "text-emerald" : "text-amber"
                          }
                        >
                          {p.status}
                        </span>
                      </p>
                    </div>
                    <div className="md:col-span-4 font-mono text-[11px] text-text-secondary break-all">
                      {p.pgPaymentId}
                    </div>
                    <div className="md:col-span-2 text-xs font-mono uppercase tracking-wider text-text">
                      {p.order?.gateway ?? "—"}
                    </div>
                    <div className="md:col-span-2 md:text-right text-sm font-semibold font-mono text-text">
                      {formatAmount(p.amount, p.currency)}
                    </div>
                    <div className="md:col-span-1 md:text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => printReceipt(p, orgName)}
                        className="text-text-muted hover:text-text hover:bg-surface border border-transparent hover:border-obs-border rounded-lg"
                        title="Print receipt"
                      >
                        <LuPrinter />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          </div>
        </div>
      </div>
    </div>
  );
}
