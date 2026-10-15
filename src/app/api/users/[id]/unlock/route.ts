import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return NextResponse.json(
        { message: auth.message },
        { status: auth.status }
      );
    }

    const { id } = await params;

    if (!id || id.length > 64) {
      return NextResponse.json(
        { message: "A valid user is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        lockedUntil: true,
        failedLoginAttempts: true,
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    const locked =
      existing.lockedUntil !== null && existing.lockedUntil > new Date();

    if (!locked && existing.failedLoginAttempts === 0) {
      return NextResponse.json({
        message: "This account is not locked.",
      });
    }

    await prisma.user.update({
      where: { id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    return NextResponse.json({
      message: "Account unlocked. The user can sign in again.",
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    console.error("Failed to unlock user:", error);

    return NextResponse.json(
      { message: "Failed to unlock the account." },
      { status: 500 }
    );
  }
}
