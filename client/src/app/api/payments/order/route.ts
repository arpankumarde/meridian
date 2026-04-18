import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  createRazorpayOrder,
  DEFAULT_CURRENCY,
  QUARTERLY_AMOUNT_PAISE,
  RAZORPAY_GATEWAY,
} from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { organizationId, subscriptionId, amount, currency, receipt, notes } =
      body ?? {};

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId is required" },
        { status: 400 }
      );
    }

    const org = await prisma.organization.findUnique({
      where: { id: organizationId },
    });
    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    let subscription = subscriptionId
      ? await prisma.subscription.findUnique({ where: { id: subscriptionId } })
      : null;

    if (!subscription) {
      subscription = await prisma.subscription.create({
        data: {
          organizationId,
          plan: "QUARTERLY",
          amount: QUARTERLY_AMOUNT_PAISE,
          currency: DEFAULT_CURRENCY,
          status: "PENDING",
        },
      });
    }

    const rzpOrder = await createRazorpayOrder({
      amount: amount ?? subscription.amount,
      currency: currency ?? subscription.currency,
      receipt,
      notes: { organizationId, subscriptionId: subscription.id, ...(notes ?? {}) },
    });

    const order = await prisma.order.create({
      data: {
        organizationId,
        subscriptionId: subscription.id,
        pgOrderId: rzpOrder.id,
        gateway: RAZORPAY_GATEWAY,
        amount: Number(rzpOrder.amount),
        currency: rzpOrder.currency,
        receipt: rzpOrder.receipt ?? null,
        status: "CREATED",
        meta: rzpOrder as unknown as object,
      },
    });

    return NextResponse.json({
      orderId: order.id,
      pgOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key: process.env.PG_KEY_ID,
      subscriptionId: subscription.id,
    });
  } catch (err) {
    console.error("[payments/order] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
