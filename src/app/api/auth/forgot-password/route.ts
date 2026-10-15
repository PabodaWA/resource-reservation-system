import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isMailConfigured } from "@/lib/mail";
import { sendPasswordResetOtpEmail } from "@/lib/password-reset-mail";
import {
  OTP_RESEND_COOLDOWN_MS,
  OTP_TTL_MS,
  generateOtp,
  hashOtp,
  normalizeResetEmail,
  resendCooldownMs,
} from "@/lib/password-reset";

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
      typeof body.email !== "string"
    ) {
      return NextResponse.json(
        { message: "Enter the email address registered on this system." },
        { status: 400 }
      );
    }

    const email = normalizeResetEmail(body.email);

    if (!email) {
      return NextResponse.json(
        { message: "Enter a valid email address." },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.isActive) {
      return NextResponse.json(
        { message: "No active account is registered with that email." },
        { status: 404 }
      );
    }

    if (user.mustChangePassword) {
      if (user.passwordResetOtpHash || user.passwordResetOtpExpiry) {
        await prisma.user.update({
          where: { id: user.id },
          data: clearedReset,
        });
      }

      return NextResponse.json(
        {
          message:
            "This account still uses a temporary password. Sign in with the password from your welcome email and set your own password. Password reset is available after that.",
        },
        { status: 403 }
      );
    }

    if (user.passwordResetOtpExpiry) {
      const waitMs = resendCooldownMs(user.passwordResetOtpExpiry);

      if (waitMs > 0) {
        const waitSeconds = Math.ceil(waitMs / 1000);

        return NextResponse.json(
          {
            message: `A code was just sent. Wait ${waitSeconds} seconds before requesting another.`,
            retryAfterSeconds: waitSeconds,
          },
          { status: 429 }
        );
      }
    }

    if (!isMailConfigured()) {
      return NextResponse.json(
        { message: "Email is not available right now. Please try again later." },
        { status: 503 }
      );
    }

    const otp = generateOtp();
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const cooldownCutoff = new Date(
      Date.now() - OTP_RESEND_COOLDOWN_MS + OTP_TTL_MS
    );

    const reserved = await prisma.user.updateMany({
      where: {
        id: user.id,
        isActive: true,
        OR: [
          { passwordResetOtpExpiry: null },
          { passwordResetOtpExpiry: { lte: cooldownCutoff } },
        ],
      },
      data: {
        passwordResetOtpHash: hashOtp(email, otp),
        passwordResetOtpExpiry: expiresAt,
        passwordResetAttempts: 0,
      },
    });

    if (reserved.count !== 1) {
      return NextResponse.json(
        {
          message: "A code was just sent. Wait a minute before requesting another.",
          retryAfterSeconds: 60,
        },
        { status: 429 }
      );
    }

    try {
      await sendPasswordResetOtpEmail({
        to: user.email,
        name: user.name,
        otp,
      });
    } catch (error) {
      await prisma.user.update({
        where: { id: user.id },
        data: clearedReset,
      });
      throw error;
    }

    return NextResponse.json({
      message:
        "A reset code was sent to that email. It expires in 5 minutes.",
      expiresInSeconds: OTP_TTL_MS / 1000,
    });
  } catch (error) {
    console.error("Forgot password error:", error);

    return NextResponse.json(
      { message: "Unable to send the reset code. Please try again." },
      { status: 500 }
    );
  }
}
