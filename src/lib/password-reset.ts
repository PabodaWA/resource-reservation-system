import "server-only";

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const OTP_TTL_MS = 5 * 60 * 1000;
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
export const MAX_OTP_ATTEMPTS = 5;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeResetEmail(value: string): string | null {
  const email = value.trim().toLowerCase();

  if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
    return null;
  }

  return email;
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

export function normalizeOtp(value: string): string | null {
  const otp = value.replaceAll(/\s/g, "");

  if (!/^\d{6}$/.test(otp)) {
    return null;
  }

  return otp;
}

function resetSecret(): string {
  const secret = process.env.AUTH_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "AUTH_SECRET must be configured with at least 32 characters."
    );
  }

  return secret;
}

export function hashOtp(email: string, otp: string): string {
  return createHmac("sha256", resetSecret())
    .update(`${email}:${otp}`)
    .digest("hex");
}

export function otpMatches(email: string, otp: string, hash: string): boolean {
  const actual = Buffer.from(hashOtp(email, otp), "utf8");
  const expected = Buffer.from(hash, "utf8");

  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
}

export function resendCooldownMs(otpExpiry: Date, now = Date.now()): number {
  const sentAt = otpExpiry.getTime() - OTP_TTL_MS;
  const remaining = OTP_RESEND_COOLDOWN_MS - (now - sentAt);

  return remaining > 0 ? remaining : 0;
}
