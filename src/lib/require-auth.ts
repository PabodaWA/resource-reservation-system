
import "server-only";

import { prisma } from "@/lib/prisma";
import { getSessionUser, type SessionUser } from "@/lib/auth";

export type AuthResult =
  | { ok: true; user: SessionUser }
  | {
      ok: false;
      status: 401 | 403;
      message: string;
    };

export async function requireAuth(
  options: { allowPasswordChange?: boolean } = {}
): Promise<AuthResult> {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return {
      ok: false,
      status: 401,
      message: "Please sign in first.",
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive) {
    return {
      ok: false,
      status: 401,
      message: "Your account is unavailable. Please sign in again.",
    };
  }

  if (
    user.mustChangePassword &&
    !options.allowPasswordChange
  ) {
    return {
      ok: false,
      status: 403,
      message: "Please change your password before continuing.",
    };
  }

  return {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
    },
  };
}

export async function requireAdmin(): Promise<AuthResult> {
  const result = await requireAuth();

  if (!result.ok) {
    return result;
  }

  if (result.user.role !== "ADMIN") {
    return {
      ok: false,
      status: 403,
      message: "Administrator access is required.",
    };
  }

  return result;
}
