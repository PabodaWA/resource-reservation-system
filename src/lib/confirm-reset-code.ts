import "server-only";

import { prisma } from "@/lib/prisma";
import {
  MAX_OTP_ATTEMPTS,
  normalizeOtp,
  otpMatches,
} from "@/lib/password-reset";

const clearedReset = {
  passwordResetOtpHash: null,
  passwordResetOtpExpiry: null,
  passwordResetAttempts: 0,
};

export type ConfirmedResetCode = {
  ok: true;
  userId: string;
  otpHash: string;
  passwordHash: string | null;
};

export type RejectedResetCode = {
  ok: false;
  status: number;
  message: string;
};

export async function confirmResetCode(
  email: string,
  otpInput: string
): Promise<ConfirmedResetCode | RejectedResetCode> {
  const otp = normalizeOtp(otpInput);

  if (!otp) {
    return {
      ok: false,
      status: 400,
      message: "Enter the 6-digit code from the email.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (
    !user ||
    !user.isActive ||
    !user.passwordResetOtpHash ||
    !user.passwordResetOtpExpiry
  ) {
    return {
      ok: false,
      status: 400,
      message: "That code is invalid or has expired. Request a new one.",
    };
  }

  if (user.passwordResetOtpExpiry.getTime() <= Date.now()) {
    await prisma.user.update({
      where: { id: user.id },
      data: clearedReset,
    });

    return {
      ok: false,
      status: 400,
      message: "This code has expired. Request a new one.",
    };
  }

  if (user.passwordResetAttempts >= MAX_OTP_ATTEMPTS) {
    await prisma.user.update({
      where: { id: user.id },
      data: clearedReset,
    });

    return {
      ok: false,
      status: 400,
      message: "Too many incorrect attempts. Request a new code.",
    };
  }

  if (!otpMatches(email, otp, user.passwordResetOtpHash)) {
    const nextAttempts = user.passwordResetAttempts + 1;
    const lockedOut = nextAttempts >= MAX_OTP_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: lockedOut
        ? clearedReset
        : { passwordResetAttempts: nextAttempts },
    });

    return {
      ok: false,
      status: 400,
      message: lockedOut
        ? "Too many incorrect attempts. Request a new code."
        : "That code is incorrect.",
    };
  }

  return {
    ok: true,
    userId: user.id,
    otpHash: user.passwordResetOtpHash,
    passwordHash: user.passwordHash,
  };
}
