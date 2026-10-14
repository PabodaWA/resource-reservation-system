import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import AdminDashboardClient, {
  type AdminDashboardData,
} from "./admin-dashboard-client";

export const metadata = {
  title: "Admin Dashboard | Ruhunu ResourceHub",
};

function timingOf(start: Date, end: Date, now: Date) {
  if (end.getTime() <= now.getTime()) {
    return "past" as const;
  }

  if (start.getTime() <= now.getTime()) {
    return "in_progress" as const;
  }

  return "upcoming" as const;
}

async function ProtectedAdmin() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      mustChangePassword: true,
    },
  });

  if (!user || !user.isActive) {
    redirect("/login");
  }

  if (user.mustChangePassword) {
    redirect("/change-password");
  }

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  const now = new Date();

  const [users, resources, reservations] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    }),
    prisma.resource.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        type: true,
        location: true,
        capacity: true,
        description: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.reservation.findMany({
      orderBy: { startTime: "desc" },
      select: {
        id: true,
        title: true,
        purpose: true,
        startTime: true,
        endTime: true,
        status: true,
        resourceId: true,
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        resource: {
          select: {
            name: true,
            type: true,
            location: true,
          },
        },
        participants: {
          orderBy: { createdAt: "asc" },
          select: {
            name: true,
            email: true,
          },
        },
      },
    }),
  ]);

  const data: AdminDashboardData = {
    admin: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    users: users.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
    })),
    resources: resources.map((item) => ({
      id: item.id,
      name: item.name,
      type: item.type,
      location: item.location,
      capacity: item.capacity,
      description: item.description,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
    })),
    reservations: reservations.map((item) => ({
      id: item.id,
      title: item.title,
      purpose: item.purpose,
      startTime: item.startTime.toISOString(),
      endTime: item.endTime.toISOString(),
      status: item.status,
      timing: timingOf(item.startTime, item.endTime, now),
      resourceId: item.resourceId,
      userName: item.user.name,
      userEmail: item.user.email,
      resourceName: item.resource.name,
      resourceType: item.resource.type,
      resourceLocation: item.resource.location,
      participants: item.participants,
    })),
  };

  return <AdminDashboardClient data={data} />;
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-600">Loading admin workspace...</p>
        </main>
      }
    >
      <ProtectedAdmin />
    </Suspense>
  );
}
