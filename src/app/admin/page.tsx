import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import AdminDashboardClient, {
  type AdminDashboardData,
} from "./admin-dashboard-client";

export const metadata = {
  title: "Admin Dashboard | ReserveFlow",
};

async function AdminDashboardContent() {
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

  const [
    users,
    resources,
    reservations,
    totalReservations,
    confirmedReservations,
    cancelledReservations,
  ] = await Promise.all([
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { reservations: true } },
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
        _count: { select: { reservations: true } },
      },
    }),
    prisma.reservation.findMany({
      orderBy: { startTime: "desc" },
      take: 100,
      select: {
        id: true,
        title: true,
        purpose: true,
        startTime: true,
        endTime: true,
        status: true,
        user: { select: { name: true, email: true } },
        resource: { select: { name: true, location: true } },
      },
    }),
    prisma.reservation.count(),
    prisma.reservation.count({ where: { status: "CONFIRMED" } }),
    prisma.reservation.count({ where: { status: "CANCELLED" } }),
  ]);

  const data: AdminDashboardData = {
    admin: {
      id: user.id,
      name: user.name,
      email: user.email,
    },
    stats: {
      totalUsers: users.length,
      activeUsers: users.filter((item) => item.isActive).length,
      adminUsers: users.filter((item) => item.role === "ADMIN").length,
      totalResources: resources.length,
      activeResources: resources.filter((item) => item.status === "ACTIVE")
        .length,
      totalCapacity: resources.reduce(
        (total, item) => total + item.capacity,
        0
      ),
      totalReservations,
      confirmedReservations,
      cancelledReservations,
    },
    users: users.map((item) => ({
      id: item.id,
      name: item.name,
      email: item.email,
      role: item.role,
      isActive: item.isActive,
      createdAt: item.createdAt.toISOString(),
      reservationCount: item._count.reservations,
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
      reservationCount: item._count.reservations,
    })),
    reservations: reservations.map((item) => ({
      id: item.id,
      title: item.title,
      purpose: item.purpose,
      startTime: item.startTime.toISOString(),
      endTime: item.endTime.toISOString(),
      status: item.status,
      userName: item.user.name,
      userEmail: item.user.email,
      resourceName: item.resource.name,
      resourceLocation: item.resource.location,
    })),
  };

  return <AdminDashboardClient data={data} />;
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-600">Loading admin dashboard...</p>
        </main>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
