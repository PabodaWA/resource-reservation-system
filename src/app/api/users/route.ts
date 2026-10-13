
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

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
      typeof body.name !== "string" ||
      typeof body.email !== "string"
    ) {
      return NextResponse.json(
        { message: "Valid name and email are required." },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const email = body.email.trim().toLowerCase();

    if (
      !name ||
      name.length > 120 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254
    ) {
      return NextResponse.json(
        { message: "Please provide a valid name and email." },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingUser) {
      return NextResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 }
      );
    }

    // Generate a temporary password on the server.
    const temporaryPassword = `${crypto.randomUUID()}Aa1!`;
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "MEMBER",
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        mustChangePassword: true,
        createdAt: true,
      },
    });

    return NextResponse.json(
      {
        message: "User created successfully.",
        user,
        temporaryPassword,
      },
      { status: 201 }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { message: "A user with this email already exists." },
        { status: 409 }
      );
    }

    console.error("Failed to create user:", error);

    return NextResponse.json(
      { message: "Failed to create user." },
      { status: 500 }
    );
  }
}
