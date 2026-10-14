import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { resolveJobPosition } from "@/lib/job-position";
import { isMailConfigured, sendTemporaryPasswordEmail } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createTemporaryPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let body = "";

  for (let index = 0; index < 14; index += 1) {
    body += alphabet[randomInt(alphabet.length)];
  }

  return `Rf-${body}`;
}

function loginUrlFor(request: Request): string {
  const configured = process.env.APP_URL?.trim();

  if (configured) {
    try {
      const base = new URL(configured);

      if (base.protocol === "http:" || base.protocol === "https:") {
        return new URL("/login", base).toString();
      }
    } catch {
      // Fall back to the request origin when APP_URL is not a valid URL.
    }
  }

  return new URL("/login", new URL(request.url).origin).toString();
}

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
      !("role" in body) ||
      typeof body.name !== "string" ||
      typeof body.email !== "string" ||
      (body.role !== "ADMIN" && body.role !== "MEMBER")
    ) {
      return NextResponse.json(
        { message: "Name, email, and role are required." },
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

    const existingEmail = await prisma.user.findUnique({
      where: { email },
      select: { id: true },
    });

    if (existingEmail) {
      return NextResponse.json(
        { message: "An account with this email already exists." },
        { status: 409 }
      );
    }

    if (!isMailConfigured()) {
      return NextResponse.json(
        {
          message:
            "Email is not configured, so the account was not created.",
        },
        { status: 503 }
      );
    }

    const password = createTemporaryPassword();
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: body.role,
        jobPosition,
        isActive: true,
        mustChangePassword: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        jobPosition: true,
      },
    });

    try {
      await sendTemporaryPasswordEmail({
        to: user.email,
        name: user.name,
        temporaryPassword: password,
        loginUrl: loginUrlFor(request),
      });
    } catch (mailError) {
      console.error("Failed to email the new user:", mailError);

      await prisma.user.delete({ where: { id: user.id } }).catch((deleteError) => {
        console.error("Failed to remove the user after the email error:", deleteError);
      });

      return NextResponse.json(
        {
          message:
            "The sign-in email could not be sent, so the account was not created.",
        },
        { status: 502 }
      );
    }

    return NextResponse.json(
      {
        message: "User created. Sign-in details were emailed to them.",
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
