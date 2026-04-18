import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";
import {
  createRazorpayOrder,
  DEFAULT_CURRENCY,
  QUARTERLY_AMOUNT_PAISE,
  RAZORPAY_GATEWAY,
} from "@/lib/razorpay";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password, orgName, orgDomain, orgLogo } = body ?? {};

    if (!email || !password || !orgName || !orgDomain) {
      return NextResponse.json(
        { error: "email, password, orgName, orgDomain are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "User with this email already exists" },
        { status: 409 }
      );
    }

    const existingOrg = await prisma.organization.findUnique({
      where: { domain: orgDomain },
    });
    if (existingOrg) {
      return NextResponse.json(
        { error: "Organization with this domain already exists" },
        { status: 409 }
      );
    }

    const org = await prisma.organization.create({
      data: { name: orgName, domain: orgDomain, logo: orgLogo ?? null },
    });

    const user = await prisma.user.create({
      data: {
        email,
        password: hashPassword(password),
        organizationId: org.id,
      },
    });

    const subscription = await prisma.subscription.create({
      data: {
        organizationId: org.id,
        plan: "QUARTERLY",
        amount: QUARTERLY_AMOUNT_PAISE,
        currency: DEFAULT_CURRENCY,
        status: "PENDING",
      },
    });

    const rzpOrder = await createRazorpayOrder({
      amount: subscription.amount,
      currency: subscription.currency,
      notes: {
        organizationId: org.id,
        subscriptionId: subscription.id,
        userId: user.id,
      },
    });

    const order = await prisma.order.create({
      data: {
        organizationId: org.id,
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
      userId: user.id,
      organizationId: org.id,
      subscriptionId: subscription.id,
      orderId: order.id,
      pgOrderId: rzpOrder.id,
      amount: rzpOrder.amount,
      currency: rzpOrder.currency,
      key: process.env.PG_KEY_ID,
    });
  } catch (err) {
    console.error("[auth/signup] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
