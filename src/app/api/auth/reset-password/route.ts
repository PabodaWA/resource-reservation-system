import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { confirmResetCode } from "@/lib/confirm-reset-code";
import { normalizeResetEmail } from "@/lib/password-reset";

const clearedReset = {
  passwordResetOtpHash: null,
  passwordResetOtpExpiry: null,
  passwordResetAttempts: 0,
};

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("email" in body) ||
      !("otp" in body) ||
      !("newPassword" in body) ||
      typeof body.email !== "string" ||
      typeof body.otp !== "string" ||
      typeof body.newPassword !== "string"
    ) {
      return NextResponse.json(
        { message: "Email, reset code, and new password are required." },
        { status: 400 }
      );
    }

    const email = normalizeResetEmail(body.email);
    const newPassword = body.newPassword;

    if (!email) {
      return NextResponse.json(
        { message: "Enter the email and the 6-digit code from the email." },
        { status: 400 }
      );
    }

    const result = await confirmResetCode(email, body.otp);

    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status }
      );
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
      return NextResponse.json(
        { message: "New password must contain 12–128 characters." },
        { status: 400 }
      );
    }

    if (result.passwordHash) {
      const samePassword = await bcrypt.compare(
        newPassword,
        result.passwordHash
      );

      if (samePassword) {
        return NextResponse.json(
          { message: "Choose a different password." },
          { status: 400 }
        );
      }
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);

    const updated = await prisma.user.updateMany({
      where: {
        id: result.userId,
        isActive: true,
        passwordResetOtpHash: result.otpHash,
        passwordResetOtpExpiry: { gt: new Date() },
      },
      data: {
        passwordHash,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null,
        ...clearedReset,
      },
    });

    if (updated.count !== 1) {
      return NextResponse.json(
        { message: "This code has expired. Request a new one." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      message: "Password updated. Sign in with your new password.",
    });
  } catch (error) {
    console.error("Reset password error:", error);

    return NextResponse.json(
      { message: "Unable to reset the password. Please try again." },
      { status: 500 }
    );
  }
}
