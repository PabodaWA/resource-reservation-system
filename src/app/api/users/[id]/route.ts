import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { resolveJobPosition } from "@/lib/job-position";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function PATCH(
  request: Request,
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

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("name" in body) ||
      !("email" in body) ||
      !("role" in body) ||
      !("isActive" in body) ||
      typeof body.name !== "string" ||
      typeof body.email !== "string" ||
      typeof body.isActive !== "boolean" ||
      (body.role !== "ADMIN" && body.role !== "MEMBER")
    ) {
      return NextResponse.json(
        { message: "Name, email, role, and status are required." },
        { status: 400 }
      );
    }

    const jobPosition = resolveJobPosition(
      body.role,
      "jobPosition" in body ? body.jobPosition : undefined
    );

    if (!jobPosition) {
      return NextResponse.json(
        { message: "Select a job position." },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const email = body.email.trim().toLowerCase();

    if (!name || name.length > 120) {
      return NextResponse.json(
        { message: "Name must be between 1 and 120 characters." },
        { status: 400 }
      );
    }

    if (!EMAIL_PATTERN.test(email) || email.length > 254) {
      return NextResponse.json(
        { message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const emailOwner = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (emailOwner && emailOwner.id !== id) {
      return NextResponse.json(
        { message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    const existing = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (id === auth.user.id && body.role !== "ADMIN") {
      return NextResponse.json(
        { message: "You cannot remove your own administrator role." },
        { status: 400 }
      );
    }

    if (id === auth.user.id && !body.isActive) {
      return NextResponse.json(
        { message: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }

    if (existing.role === "ADMIN" && body.role === "MEMBER") {
      const adminCount = await prisma.user.count({
        where: { role: "ADMIN" },
      });

      if (adminCount <= 1) {
        return NextResponse.json(
          { message: "The last administrator cannot be changed to a user." },
          { status: 400 }
        );
      }
    }

    const user = await prisma.user.update({
      where: { id },
      data: {
        name,
        email,
        role: body.role,
        jobPosition,
        isActive: body.isActive,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobPosition: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      message: "User updated.",
      user,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    console.error("Failed to update user:", error);

    return NextResponse.json(
      { message: "Failed to update the user." },
      { status: 500 }
    );
  }
}

export async function DELETE(
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

    if (id === auth.user.id) {
      return NextResponse.json(
        { message: "You cannot deactivate your own account." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, name: true, role: true, isActive: true },
    });

    if (!user) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json({
        message: "This account is already inactive.",
        user: {
          id: user.id,
          isActive: false,
        },
      });
    }

    if (user.role === "ADMIN") {
      const activeAdminCount = await prisma.user.count({
        where: { role: "ADMIN", isActive: true },
      });

      if (activeAdminCount <= 1) {
        return NextResponse.json(
          { message: "The last administrator cannot be deactivated." },
          { status: 400 }
        );
      }
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: false },
      select: {
        id: true,
        name: true,
        isActive: true,
      },
    });

    return NextResponse.json({
      message: "Account is now inactive.",
      user: updated,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "User not found." },
        { status: 404 }
      );
    }

    console.error("Failed to deactivate user:", error);

    return NextResponse.json(
      { message: "Failed to deactivate the user." },
      { status: 500 }
    );
  }
}
