import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * GET /api/organizations/[orgId]/billing
 * Returns current plan (latest subscription) for the organization.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ orgId: string }> }
) {
  try {
    const { orgId } = await params;

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true, name: true },
    });

    if (!org) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    const subscription = await prisma.subscription.findFirst({
      where: { organizationId: orgId },
      orderBy: [{ createdAt: "desc" }],
    });

    const payments = await prisma.payment.findMany({
      where: { order: { organizationId: orgId } },
      orderBy: { createdAt: "desc" },
      take: 25,
      select: {
        id: true,
        pgPaymentId: true,
        method: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        order: {
          select: { pgOrderId: true, receipt: true, gateway: true },
        },
      },
    });

    return NextResponse.json({
      organization: org,
      subscription,
      payments,
    });
  } catch (err) {
    console.error("[org/billing] GET error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
