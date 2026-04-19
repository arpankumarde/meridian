import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userId, code, purpose = "LOGIN" } = body ?? {};

    if (!userId || !code) {
      return NextResponse.json(
        { error: "userId and code are required" },
        { status: 400 }
      );
    }

    const otp = await prisma.otp.findFirst({
      where: {
        userId,
        code,
        purpose,
        consumedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otp) {
      return NextResponse.json(
        { error: "Invalid or expired OTP" },
        { status: 400 }
      );
    }

    await prisma.otp.update({
      where: { id: otp.id },
      data: { consumedAt: new Date() },
    });

    if (purpose === "LOGIN") {
      await prisma.user.update({
        where: { id: userId },
        data: { emailVerified: true },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { organizationId: true },
    });

    return NextResponse.json({ ok: true, userId, organizationId: user?.organizationId });
  } catch (err) {
    console.error("[auth/verify-otp] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
