
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_DURATION_MS = 60 * 60 * 1000;

function invalidCredentials() {
  return NextResponse.json(
    { message: "Invalid email or password." },
    { status: 401 }
  );
}

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("email" in body) ||
      !("password" in body) ||
      typeof body.email !== "string" ||
      typeof body.password !== "string"
    ) {
      return NextResponse.json(
        { message: "Email and password are required." },
        { status: 400 }
      );
    }

    const email = body.email.trim().toLowerCase();
    const password = body.password;

    if (!email || !password || email.length > 254 || password.length > 128) {
      return invalidCredentials();
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      return invalidCredentials();
    }

    if (!user.isActive) {
      return invalidCredentials();
    }

    const now = new Date();

    if (user.lockedUntil && user.lockedUntil > now) {
      return NextResponse.json(
        {
          message:
            "Account locked. Contact an administrator to unlock it, or try again after the lock expires.",
        },
        { status: 423 }
      );
    }

    // Clear an expired lock before checking the password.
    if (user.lockedUntil && user.lockedUntil <= now) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lockedUntil: null,
        },
      });
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.passwordHash
    );

    if (!passwordMatches) {
      const nextAttempts = user.lockedUntil
        ? 1
        : user.failedLoginAttempts + 1;

      const shouldLock = nextAttempts >= MAX_FAILED_ATTEMPTS;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: shouldLock ? 0 : nextAttempts,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCK_DURATION_MS)
            : null,
        },
      });

      if (shouldLock) {
        return NextResponse.json(
          {
            message:
              "Too many failed attempts. Account locked for 1 hour. Contact an administrator to unlock it sooner.",
          },
          { status: 423 }
        );
      }

      return invalidCredentials();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    await createSession({
      id: user.id,
      email: user.email,
      role: user.role,
    });

    return NextResponse.json({
      message: "Login successful.",
      requiresPasswordChange: user.mustChangePassword,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return NextResponse.json(
      { message: "An unexpected error occurred. Please try again." },
      { status: 500 }
    );
  }
}
