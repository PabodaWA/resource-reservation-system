
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import ChangePasswordForm from "./change-password-form";

export default async function ChangePasswordPage() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive) {
    redirect("/login");
  }

  if (!user.mustChangePassword) {
    redirect("/");
  }

  return <ChangePasswordForm />;
}
