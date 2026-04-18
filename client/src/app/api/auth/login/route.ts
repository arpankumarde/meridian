import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { generateOtp, OTP_TTL_MS, verifyPassword } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { email, password } = body ?? {};

    if (!email || !password) {
      return NextResponse.json(
        { error: "email and password are required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !verifyPassword(password, user.password)) {
      return NextResponse.json(
        { error: "Invalid credentials" },
        { status: 401 }
      );
    }

    const code = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    await prisma.otp.create({
      data: { userId: user.id, code, purpose: "LOGIN", expiresAt },
    });

    // Production: send via email. For /test flow we return it in the response.
    console.log(`[auth/login] OTP for ${email}: ${code}`);

    return NextResponse.json({
      userId: user.id,
      otpSent: true,
      devOtp: process.env.NODE_ENV !== "production" ? code : undefined,
    });
  } catch (err) {
    console.error("[auth/login] error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
