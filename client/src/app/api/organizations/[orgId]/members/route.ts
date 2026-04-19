import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { hashPassword } from "@/lib/auth";

/**
 * GET /api/organizations/[orgId]/members
 * Returns all team members for the specific organization.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = await params;

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const members = await prisma.user.findMany({
      where: { organizationId: orgId },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        emailVerified: true,
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(members);
  } catch (err) {
    console.error("[org/members] GET error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/organizations/[orgId]/members
 * Creates a new team member for the organization.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { orgId: string } }
) {
  try {
    const { orgId } = await params;
    const { name, email, password } = await req.json();

    if (!orgId || !name || !email || !password) {
      return NextResponse.json(
        { error: "orgId, name, email, and password are required" },
        { status: 400 }
      );
    }

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashPassword(password),
        organizationId: orgId,
        emailVerified: true, // Auto-verify added members for now
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json(newUser, { status: 201 });
  } catch (err) {
    console.error("[org/members] POST error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
