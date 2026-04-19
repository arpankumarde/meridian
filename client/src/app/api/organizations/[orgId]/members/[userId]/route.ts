import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

/**
 * DELETE /api/organizations/[orgId]/members/[userId]
 * Removes a member from the organization.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; userId: string }> }
) {
  try {
    const { orgId, userId } = await params;

    if (!orgId || !userId) {
      return NextResponse.json(
        { error: "orgId and userId are required" },
        { status: 400 }
      );
    }

    const member = await prisma.user.findFirst({
      where: { id: userId, organizationId: orgId },
      select: { id: true },
    });

    if (!member) {
      return NextResponse.json(
        { error: "Member not found in this organization" },
        { status: 404 }
      );
    }

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[org/members/:userId] DELETE error", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
