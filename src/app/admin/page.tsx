
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSessionUser } from "@/lib/auth";

async function AdminDashboardContent() {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: {
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

  const [totalResources, activeResources, totalUsers, totalReservations] =
    await Promise.all([
      prisma.resource.count(),
      prisma.resource.count({ where: { status: "ACTIVE" } }),
      prisma.user.count(),
      prisma.reservation.count(),
    ]);

  return (
    <main className="min-h-screen bg-slate-50 p-6 md:p-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-indigo-600">
              ReserveFlow · Administration
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900">
              Admin Dashboard
            </h1>
            <p className="mt-2 text-slate-600">
              Welcome, {user.name}. Manage your organization&apos;s resources
              and reservations.
            </p>
          </div>

          <a
            href="/"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100"
          >
            Resource Dashboard
          </a>
        </header>

        <section className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {[
            {
              label: "Total Resources",
              value: totalResources,
              description: "All registered resources",
            },
            {
              label: "Active Resources",
              value: activeResources,
              description: "Available for management",
            },
            {
              label: "Total Users",
              value: totalUsers,
              description: "Registered accounts",
            },
            {
              label: "Reservations",
              value: totalReservations,
              description: "All recorded reservations",
            },
          ].map((item) => (
            <article
              key={item.label}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <p className="text-sm font-medium text-slate-500">
                {item.label}
              </p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {item.value}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {item.description}
              </p>
            </article>
          ))}
        </section>

        <section className="mt-8 grid gap-5 md:grid-cols-2">
          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Resource Management
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review registered resources and manage shared facilities.
            </p>
            <a
              href="/#resources"
              className="mt-5 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Manage Resources
            </a>
          </article>

          <article className="rounded-2xl border border-slate-200 bg-white p-6">
            <h2 className="text-lg font-bold text-slate-900">
              Reservation Management
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Review the current reservation activity and manage bookings.
            </p>
            <p className="mt-5 text-sm font-medium text-amber-700">
              Reservation tools are being developed.
            </p>
          </article>
        </section>

        <footer className="mt-10 text-center text-sm text-slate-500">
          Signed in as {user.email} · Administrator
        </footer>
      </div>
    </main>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-50">
          <p className="text-sm text-slate-600">
            Loading admin dashboard...
          </p>
        </main>
      }
    >
      <AdminDashboardContent />
    </Suspense>
  );
}
