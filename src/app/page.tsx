import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";
import DashboardClient, {
  type UserDashboardData,
} from "./dashboard-client";

export const metadata = {
  title: "My Dashboard | Ruhunu ResourceHub",
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

async function ProtectedDashboard() {
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
      jobPosition: true,
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

  const now = new Date();
  const horizon = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);

  const [resources, reservations, upcomingSlots, occupied] = await Promise.all([
    prisma.resource.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true,
        location: true,
        capacity: true,
        description: true,
        images: true,
      },
    }),
    prisma.reservation.findMany({
      where: { userId: user.id },
      orderBy: { startTime: "desc" },
      select: {
        id: true,
        title: true,
        purpose: true,
        startTime: true,
        endTime: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resourceId: true,
        resource: {
          select: {
            name: true,
            category: true,
            subcategory: true,
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
    prisma.reservation.groupBy({
      by: ["resourceId"],
      where: {
        status: { in: ["CONFIRMED", "PENDING"] },
        endTime: { gt: now },
      },
      _count: { _all: true },
    }),
    prisma.reservation.findMany({
      where: {
        status: { in: ["CONFIRMED", "PENDING"] },
        endTime: { gt: now },
        startTime: { lt: horizon },
      },
      select: {
        resourceId: true,
        startTime: true,
        endTime: true,
      },
    }),
  ]);

  const upcomingByResource = new Map(
    upcomingSlots.map((slot) => [slot.resourceId, slot._count._all])
  );

  const data: UserDashboardData = {
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      jobPosition: user.jobPosition,
    },
    resources: resources.map((resource) => ({
      id: resource.id,
      name: resource.name,
      category: resource.category,
      subcategory: resource.subcategory,
      location: resource.location,
      capacity: resource.capacity,
      description: resource.description,
      images: resource.images,
      upcomingBookings: upcomingByResource.get(resource.id) ?? 0,
    })),
    reservations: reservations.map((reservation) => ({
      id: reservation.id,
      title: reservation.title,
      purpose: reservation.purpose,
      startTime: reservation.startTime.toISOString(),
      endTime: reservation.endTime.toISOString(),
      status: reservation.status,
      createdAt: reservation.createdAt.toISOString(),
      updatedAt: reservation.updatedAt.toISOString(),
      timing: timingOf(reservation.startTime, reservation.endTime, now),
      resourceId: reservation.resourceId,
      resourceName: reservation.resource.name,
      resourceCategory: reservation.resource.category,
      resourceSubcategory: reservation.resource.subcategory,
      resourceLocation: reservation.resource.location,
      participants: reservation.participants,
    })),
    occupiedSlots: occupied.map((slot) => ({
      resourceId: slot.resourceId,
      startTime: slot.startTime.toISOString(),
      endTime: slot.endTime.toISOString(),
    })),
  };

  return <DashboardClient data={data} />;
}

export default function UserDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-600">Loading your dashboard...</p>
        </main>
      }
    >
      <ProtectedDashboard />
    </Suspense>
  );
}
