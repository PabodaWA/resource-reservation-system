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
        jobPosition: true,
        isActive: true,
        lockedUntil: true,
        createdAt: true,
      },
    }),
    prisma.resource.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        category: true,
        subcategory: true,
        location: true,
        capacity: true,
        description: true,
        facilities: true,
        images: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.reservation.findMany({
      orderBy: { startTime: "desc" },
      select: {
        id: true,
        userId: true,
        title: true,
        purpose: true,
        startTime: true,
        endTime: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        resourceId: true,
        user: {
          select: {
            name: true,
            email: true,
            jobPosition: true,
          },
        },
        resource: {
          select: {
            name: true,
            category: true,
            subcategory: true,
            location: true,
            capacity: true,
            description: true,
            facilities: true,
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
      jobPosition: item.jobPosition,
      isActive: item.isActive,
      lockedUntil: item.lockedUntil?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
    })),
    resources: resources.map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      location: item.location,
      capacity: item.capacity,
      description: item.description,
      facilities: item.facilities,
      images: item.images,
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    reservations: reservations.map((item) => ({
      id: item.id,
      title: item.title,
      purpose: item.purpose,
      startTime: item.startTime.toISOString(),
      endTime: item.endTime.toISOString(),
      status: item.status,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      timing: timingOf(item.startTime, item.endTime, now),
      resourceId: item.resourceId,
      userId: item.userId,
      userName: item.user.name,
      userEmail: item.user.email,
      userJobPosition: item.user.jobPosition,
      resourceName: item.resource.name,
      resourceCategory: item.resource.category,
      resourceSubcategory: item.resource.subcategory,
      resourceLocation: item.resource.location,
      resourceCapacity: item.resource.capacity,
      resourceDescription: item.resource.description,
      resourceFacilities: item.resource.facilities,
      participants: item.participants,
    })),
  };

  return <AdminDashboardClient data={data} />;
}

export default function AdminPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F4F7FB]">
          <p className="text-sm text-slate-600">Loading admin workspace...</p>
        </main>
      }
    >
      <ProtectedAdmin />
    </Suspense>
  );
}
