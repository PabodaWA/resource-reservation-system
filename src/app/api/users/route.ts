import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();

    if (!auth.ok) {
      return NextResponse.json(
        { message: auth.message },
        { status: auth.status }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("name" in body) ||
      !("email" in body) ||
      !("password" in body) ||
      !("role" in body) ||
      typeof body.name !== "string" ||
      typeof body.email !== "string" ||
      typeof body.password !== "string" ||
      (body.role !== "ADMIN" && body.role !== "MEMBER")
    ) {
      return NextResponse.json(
        { message: "Name, email, temporary password, and role are required." },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const email = body.email.trim().toLowerCase();
    const password = body.password;

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

    if (password.length < 12 || password.length > 128) {
      return NextResponse.json(
        { message: "Temporary password must contain 12–128 characters." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: body.role,
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return NextResponse.json(
      {
        message:
          "User created. They must change this temporary password at first login.",
        user,
      },
      { status: 201 }
    );
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

    console.error("Failed to create user:", error);

    return NextResponse.json(
      { message: "Failed to create the user." },
      { status: 500 }
    );
  }
}
