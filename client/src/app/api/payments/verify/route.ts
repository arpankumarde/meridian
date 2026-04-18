import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { quarterWindow, verifyRazorpaySignature } from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = body ?? {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return NextResponse.json(
        { error: "Missing payment fields" },
        { status: 400 }
      );
    }

    const valid = verifyRazorpaySignature({
      orderId: razorpay_order_id,
      paymentId: razorpay_payment_id,
      signature: razorpay_signature,
    });

    if (!valid) {
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { pgOrderId: razorpay_order_id },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const payment = await prisma.payment.upsert({
      where: { pgPaymentId: razorpay_payment_id },
      create: {
        orderId: order.id,
        pgPaymentId: razorpay_payment_id,
        pgSignature: razorpay_signature,
        amount: order.amount,
        currency: order.currency,
        status: "CAPTURED",
      },
      update: {
        pgSignature: razorpay_signature,
        status: "CAPTURED",
      },
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "PAID" },
    });

    if (order.subscriptionId) {
      const { startsAt, endsAt } = quarterWindow();
      await prisma.subscription.update({
        where: { id: order.subscriptionId },
        data: { status: "ACTIVE", startsAt, endsAt },
      });
    }

    return NextResponse.json({
      ok: true,
      paymentId: payment.id,
      orderId: order.id,
      subscriptionId: order.subscriptionId,
    });
  } catch (err) {
    console.error("[payments/verify] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
