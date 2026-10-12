"use client";

import { FormEvent, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";

export type AdminDashboardData = {
  admin: {
    name: string;
    email: string;
  };
  stats: {
    totalUsers: number;
    activeUsers: number;
    adminUsers: number;
    totalResources: number;
    activeResources: number;
    totalCapacity: number;
    totalReservations: number;
    confirmedReservations: number;
    cancelledReservations: number;
  };
  users: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    isActive: boolean;
    createdAt: string;
    reservationCount: number;
  }[];
  resources: {
    id: string;
    name: string;
    type: string;
    location: string;
    capacity: number;
    description: string | null;
    status: "ACTIVE" | "INACTIVE";
    createdAt: string;
    reservationCount: number;
  }[];
  reservations: {
    id: string;
    title: string;
    purpose: string | null;
    startTime: string;
    endTime: string;
    status: "CONFIRMED" | "CANCELLED";
    userName: string;
    userEmail: string;
    resourceName: string;
    resourceLocation: string;
  }[];
};

type Section = "overview" | "users" | "resources" | "reservations";

const sections: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "Overview", icon: "▦" },
  { id: "users", label: "Users", icon: "◉" },
  { id: "resources", label: "Resources", icon: "▤" },
  { id: "reservations", label: "Reservations", icon: "▣" },
];

const emptyForm = {
  name: "",
  type: "MEETING_ROOM",
  location: "",
  capacity: "1",
  description: "",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export default function AdminDashboardClient({
  data,
}: {
  data: AdminDashboardData;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(emptyForm);

  const firstName = data.admin.name.trim().split(/\s+/)[0] || "Admin";
  const activeRatio = data.stats.totalResources
    ? (data.stats.activeResources / data.stats.totalResources) * 100
    : 0;

  function openSection(next: Section) {
    setSection(next);
    setSearch("");
    setError("");
    setSuccess("");
  }

  function openAddResource() {
    setSection("resources");
    setSearch("");
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  async function handleLogout() {
    setLoggingOut(true);

    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });

      if (!response.ok) {
        throw new Error("Logout failed");
      }

      window.location.href = "/login";
    } catch {
      setLoggingOut(false);
      window.alert("Unable to log out. Please try again.");
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const capacity = Number(form.capacity);

    if (!Number.isInteger(capacity) || capacity < 1) {
      setError("Capacity must be a positive whole number.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          location: form.location,
          capacity,
          description: form.description,
        }),
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to create the resource.");
      }

      setForm(emptyForm);
      setShowForm(false);
      setSuccess("Resource created successfully.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  const term = search.trim().toLowerCase();

  const filteredUsers = data.users.filter((user) => {
    return (
      user.name.toLowerCase().includes(term) ||
      user.email.toLowerCase().includes(term) ||
      user.role.toLowerCase().includes(term)
    );
  });

  const filteredResources = data.resources.filter((resource) => {
    return (
      resource.name.toLowerCase().includes(term) ||
      resource.type.toLowerCase().includes(term) ||
      resource.location.toLowerCase().includes(term)
    );
  });

  const filteredReservations = data.reservations.filter((reservation) => {
    return (
      reservation.title.toLowerCase().includes(term) ||
      reservation.userName.toLowerCase().includes(term) ||
      reservation.resourceName.toLowerCase().includes(term) ||
      reservation.status.toLowerCase().includes(term)
    );
  });

  const sectionCopy: Record<Section, { kicker: string; title: string }> = {
    overview: {
      kicker: "Administration / Overview",
      title: "Admin Dashboard",
    },
    users: {
      kicker: "Administration / People",
      title: "Users",
    },
    resources: {
      kicker: "Administration / Inventory",
      title: "Resources",
    },
    reservations: {
      kicker: "Administration / Bookings",
      title: "Reservations",
    },
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-6 md:flex">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
              R
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">ReserveFlow</p>
              <p className="text-xs text-slate-500">Administration</p>
            </div>
          </div>

          <p className="mb-3 mt-10 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Manage
          </p>

          <nav className="space-y-2" aria-label="Admin sections">
            {sections.map((item) => {
              const active = section === item.id;
              const count =
                item.id === "users"
                  ? data.stats.totalUsers
                  : item.id === "resources"
                    ? data.stats.totalResources
                    : item.id === "reservations"
                      ? data.stats.totalReservations
                      : null;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSection(item.id)}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold transition ${
                    active
                      ? "bg-indigo-50 text-indigo-700"
                      : "text-slate-600 hover:bg-slate-100"
                  }`}
                >
                  <span aria-hidden="true">{item.icon}</span>
                  <span className="flex-1">{item.label}</span>
                  {count !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        active
                          ? "bg-white text-indigo-700"
                          : "bg-slate-100 text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          <div className="mt-auto rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">Organization health</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {data.stats.activeUsers} active accounts and{" "}
              {data.stats.activeResources} resources ready to book.
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{ width: `${activeRatio}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {data.stats.activeResources} of {data.stats.totalResources}{" "}
              resources active
            </p>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <header className="border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white md:hidden">
                  R
                </div>
                <div>
                  <p className="text-sm text-slate-500">
                    {sectionCopy[section].kicker}
                  </p>
                  <h1 className="mt-1 text-xl font-bold sm:text-2xl">
                    {sectionCopy[section].title}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="hidden text-right sm:block">
                  <p className="text-sm font-semibold">{data.admin.name}</p>
                  <p className="text-xs text-slate-500">{data.admin.email}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {initials(data.admin.name)}
                </div>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-60"
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto md:hidden">
              {sections.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => openSection(item.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${
                    section === item.id
                      ? "bg-indigo-600 text-white"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 p-5 sm:p-8">
            {error && (
              <div
                role="alert"
                className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <p>{error}</p>
                <button
                  type="button"
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                ✓ {success}
              </div>
            )}

            {section === "overview" && (
              <>
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 to-violet-600 p-6 text-white shadow-sm sm:p-9">
                  <div className="relative z-10 max-w-xl">
                    <p className="text-sm font-medium text-indigo-100">
                      ADMINISTRATION
                    </p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                      Welcome back, {firstName}.
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
                      See who is in the organization, which resources are
                      available, and how bookings are moving.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={openAddResource}
                        className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                      >
                        + Add new resource
                      </button>
                      <button
                        type="button"
                        onClick={() => openSection("users")}
                        className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        View users
                      </button>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
                  <div className="pointer-events-none absolute -bottom-24 right-36 h-48 w-48 rounded-full bg-white/10" />
                </section>

                <section
                  aria-label="Organization statistics"
                  className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
                >
                  <StatCard
                    label="Total users"
                    value={data.stats.totalUsers}
                    detail={`${data.stats.activeUsers} currently active`}
                    icon="◉"
                    color="indigo"
                  />
                  <StatCard
                    label="Resources"
                    value={data.stats.totalResources}
                    detail={`${data.stats.activeResources} marked active`}
                    icon="▤"
                    color="emerald"
                  />
                  <StatCard
                    label="Reservations"
                    value={data.stats.totalReservations}
                    detail={`${data.stats.confirmedReservations} confirmed`}
                    icon="▣"
                    color="violet"
                  />
                  <StatCard
                    label="Total capacity"
                    value={data.stats.totalCapacity}
                    detail="Combined resource capacity"
                    icon="♙"
                    color="amber"
                  />
                </section>

                <section className="grid gap-4 lg:grid-cols-3">
                  <Breakdown
                    title="Accounts"
                    rows={[
                      ["Administrators", data.stats.adminUsers],
                      [
                        "Members",
                        data.stats.totalUsers - data.stats.adminUsers,
                      ],
                      [
                        "Inactive",
                        data.stats.totalUsers - data.stats.activeUsers,
                      ],
                    ]}
                  />
                  <Breakdown
                    title="Resources"
                    rows={[
                      ["Active", data.stats.activeResources],
                      [
                        "Inactive",
                        data.stats.totalResources - data.stats.activeResources,
                      ],
                      ["Capacity", data.stats.totalCapacity],
                    ]}
                  />
                  <Breakdown
                    title="Bookings"
                    rows={[
                      ["Confirmed", data.stats.confirmedReservations],
                      ["Cancelled", data.stats.cancelledReservations],
                      ["Total", data.stats.totalReservations],
                    ]}
                  />
                </section>

                <section className="grid gap-4 xl:grid-cols-2">
                  <Panel
                    title="Latest users"
                    detail="Newest accounts in the organization."
                    action="View all"
                    onAction={() => openSection("users")}
                  >
                    {data.users.length === 0 ? (
                      <EmptyCopy message="No user accounts yet." />
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {data.users.slice(0, 5).map((user) => (
                          <li
                            key={user.id}
                            className="flex items-center justify-between gap-3 py-3"
                          >
                            <div className="flex min-w-0 items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700">
                                {initials(user.name)}
                              </div>
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800">
                                  {user.name}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {user.email}
                                </p>
                              </div>
                            </div>
                            <StatusPill
                              tone={user.role === "ADMIN" ? "info" : "muted"}
                            >
                              {user.role}
                            </StatusPill>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>

                  <Panel
                    title="Latest reservations"
                    detail="Most recent bookings across every resource."
                    action="View all"
                    onAction={() => openSection("reservations")}
                  >
                    {data.reservations.length === 0 ? (
                      <EmptyCopy message="No reservations have been created yet." />
                    ) : (
                      <ul className="divide-y divide-slate-100">
                        {data.reservations.slice(0, 5).map((reservation) => (
                          <li
                            key={reservation.id}
                            className="flex items-center justify-between gap-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {reservation.title}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {reservation.resourceName} ·{" "}
                                {reservation.userName}
                              </p>
                            </div>
                            <StatusPill
                              tone={
                                reservation.status === "CONFIRMED"
                                  ? "good"
                                  : "bad"
                              }
                            >
                              {reservation.status}
                            </StatusPill>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </section>
              </>
            )}

            {section === "users" && (
              <DataPanel
                title="All users"
                detail="Accounts that can sign in to ReserveFlow."
                search={search}
                onSearch={setSearch}
                searchLabel="Search users"
                placeholder="Search by name, email, or role..."
                footer={`Showing ${filteredUsers.length} of ${data.users.length} users`}
              >
                {filteredUsers.length === 0 ? (
                  <EmptyState
                    icon="◉"
                    title={
                      data.users.length === 0
                        ? "No users yet"
                        : "No matching users"
                    }
                    message={
                      data.users.length === 0
                        ? "User accounts will appear here after they are created."
                        : "Try another name, email, or role."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-6 py-4 font-semibold">User</th>
                          <th className="px-6 py-4 font-semibold">Role</th>
                          <th className="px-6 py-4 font-semibold">Status</th>
                          <th className="px-6 py-4 font-semibold">
                            Reservations
                          </th>
                          <th className="px-6 py-4 font-semibold">Joined</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredUsers.map((user) => (
                          <tr key={user.id} className="hover:bg-slate-50/70">
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-semibold text-indigo-700">
                                  {initials(user.name)}
                                </div>
                                <div>
                                  <p className="font-semibold text-slate-800">
                                    {user.name}
                                  </p>
                                  <p className="mt-1 text-xs text-slate-500">
                                    {user.email}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <StatusPill
                                tone={user.role === "ADMIN" ? "info" : "muted"}
                              >
                                {user.role}
                              </StatusPill>
                            </td>
                            <td className="px-6 py-4">
                              <StatusPill tone={user.isActive ? "good" : "muted"}>
                                {user.isActive ? "ACTIVE" : "INACTIVE"}
                              </StatusPill>
                            </td>
                            <td className="px-6 py-4 font-medium text-slate-700">
                              {user.reservationCount}
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {formatDate(user.createdAt)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DataPanel>
            )}

            {section === "resources" && (
              <>
                {showForm && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold">Add a resource</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Enter the details of the shared resource.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowForm(false)}
                        className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
                        aria-label="Close form"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <FormField label="Resource name">
                          <input
                            required
                            maxLength={100}
                            value={form.name}
                            onChange={(event) =>
                              setForm({ ...form, name: event.target.value })
                            }
                            placeholder="e.g. Conference Room A"
                            className={inputClass}
                          />
                        </FormField>
                        <FormField label="Resource type">
                          <select
                            value={form.type}
                            onChange={(event) =>
                              setForm({ ...form, type: event.target.value })
                            }
                            className={inputClass}
                          >
                            <option value="MEETING_ROOM">Meeting room</option>
                            <option value="CONFERENCE_ROOM">
                              Conference room
                            </option>
                            <option value="DESK">Desk</option>
                            <option value="PROJECTOR">Projector</option>
                            <option value="VEHICLE">Vehicle</option>
                            <option value="OTHER">Other</option>
                          </select>
                        </FormField>
                        <FormField label="Location">
                          <input
                            required
                            maxLength={150}
                            value={form.location}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                location: event.target.value,
                              })
                            }
                            placeholder="e.g. Floor 2"
                            className={inputClass}
                          />
                        </FormField>
                        <FormField label="Capacity">
                          <input
                            required
                            type="number"
                            min="1"
                            step="1"
                            value={form.capacity}
                            onChange={(event) =>
                              setForm({
                                ...form,
                                capacity: event.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </FormField>
                      </div>
                      <FormField label="Description (optional)">
                        <textarea
                          rows={3}
                          maxLength={500}
                          value={form.description}
                          onChange={(event) =>
                            setForm({
                              ...form,
                              description: event.target.value,
                            })
                          }
                          placeholder="Add useful details about this resource..."
                          className={inputClass}
                        />
                      </FormField>
                      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                        <button
                          type="button"
                          onClick={() => setShowForm(false)}
                          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving}
                          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {saving ? "Saving..." : "Save resource"}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                <DataPanel
                  title="All resources"
                  detail="Shared spaces and equipment registered in the system."
                  search={search}
                  onSearch={setSearch}
                  searchLabel="Search resources"
                  placeholder="Search by name, type, or location..."
                  footer={`Showing ${filteredResources.length} of ${data.resources.length} resources`}
                  extra={
                    <button
                      type="button"
                      onClick={openAddResource}
                      className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
                    >
                      + Add resource
                    </button>
                  }
                >
                  {filteredResources.length === 0 ? (
                    <EmptyState
                      icon="▤"
                      title={
                        data.resources.length === 0
                          ? "No resources yet"
                          : "No matching resources"
                      }
                      message={
                        data.resources.length === 0
                          ? "Add the first shared resource so people can reserve it."
                          : "Try another search term or clear your search."
                      }
                      action={
                        data.resources.length === 0 ? (
                          <button
                            type="button"
                            onClick={openAddResource}
                            className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                          >
                            + Add your first resource
                          </button>
                        ) : null
                      }
                    />
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[820px] text-left text-sm">
                        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                          <tr>
                            <th className="px-6 py-4 font-semibold">
                              Resource
                            </th>
                            <th className="px-6 py-4 font-semibold">Type</th>
                            <th className="px-6 py-4 font-semibold">
                              Location
                            </th>
                            <th className="px-6 py-4 font-semibold">
                              Capacity
                            </th>
                            <th className="px-6 py-4 font-semibold">
                              Bookings
                            </th>
                            <th className="px-6 py-4 font-semibold">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {filteredResources.map((resource) => (
                            <tr
                              key={resource.id}
                              className="hover:bg-slate-50/70"
                            >
                              <td className="px-6 py-4">
                                <div className="flex items-center gap-3">
                                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-semibold text-indigo-700">
                                    {resource.name.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-slate-800">
                                      {resource.name}
                                    </p>
                                    <p className="mt-1 max-w-56 truncate text-xs text-slate-500">
                                      {resource.description || "No description"}
                                    </p>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {labelize(resource.type)}
                              </td>
                              <td className="px-6 py-4 text-slate-600">
                                {resource.location}
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-700">
                                {resource.capacity}
                              </td>
                              <td className="px-6 py-4 font-medium text-slate-700">
                                {resource.reservationCount}
                              </td>
                              <td className="px-6 py-4">
                                <StatusPill
                                  tone={
                                    resource.status === "ACTIVE"
                                      ? "good"
                                      : "muted"
                                  }
                                >
                                  {resource.status}
                                </StatusPill>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </DataPanel>
              </>
            )}

            {section === "reservations" && (
              <DataPanel
                title="All reservations"
                detail={
                  data.stats.totalReservations > data.reservations.length
                    ? `Latest ${data.reservations.length} of ${data.stats.totalReservations} bookings.`
                    : "Bookings made against shared resources."
                }
                search={search}
                onSearch={setSearch}
                searchLabel="Search reservations"
                placeholder="Search by title, person, or resource..."
                footer={`Showing ${filteredReservations.length} of ${data.reservations.length} loaded reservations`}
              >
                {filteredReservations.length === 0 ? (
                  <EmptyState
                    icon="▣"
                    title={
                      data.reservations.length === 0
                        ? "No reservations yet"
                        : "No matching reservations"
                    }
                    message={
                      data.reservations.length === 0
                        ? "When people book a resource, the reservation will show up here with its time and status."
                        : "Try another title, person, or resource name."
                    }
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-left text-sm">
                      <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="px-6 py-4 font-semibold">Booking</th>
                          <th className="px-6 py-4 font-semibold">Resource</th>
                          <th className="px-6 py-4 font-semibold">When</th>
                          <th className="px-6 py-4 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredReservations.map((reservation) => (
                          <tr
                            key={reservation.id}
                            className="hover:bg-slate-50/70"
                          >
                            <td className="px-6 py-4">
                              <p className="font-semibold text-slate-800">
                                {reservation.title}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {reservation.userName} · {reservation.userEmail}
                              </p>
                            </td>
                            <td className="px-6 py-4">
                              <p className="font-medium text-slate-700">
                                {reservation.resourceName}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {reservation.resourceLocation}
                              </p>
                            </td>
                            <td className="px-6 py-4 text-slate-600">
                              {formatRange(
                                reservation.startTime,
                                reservation.endTime
                              )}
                            </td>
                            <td className="px-6 py-4">
                              <StatusPill
                                tone={
                                  reservation.status === "CONFIRMED"
                                    ? "good"
                                    : "bad"
                                }
                              >
                                {reservation.status}
                              </StatusPill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </DataPanel>
            )}

            <footer className="pb-2 text-center text-xs text-slate-400">
              ReserveFlow · Administration
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const letters = parts.map((part) => part.charAt(0).toUpperCase()).join("");
  return letters || "A";
}

function labelize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function formatDate(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function formatRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (start.toDateString() === end.toDateString()) {
    return `${date.format(start)} · ${time.format(start)} – ${time.format(end)}`;
  }

  return `${date.format(start)} ${time.format(start)} – ${date.format(end)} ${time.format(end)}`;
}

function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: number;
  detail: string;
  icon: string;
  color: "indigo" | "emerald" | "amber" | "violet";
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    violet: "bg-violet-50 text-violet-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold ${colors[color]}`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Breakdown({
  title,
  rows,
}: {
  title: string;
  rows: [string, number][];
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold">{title}</h2>
      <div className="mt-4 space-y-2">
        {rows.map(([label, value]) => (
          <div
            key={label}
            className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
          >
            <span className="text-sm text-slate-600">{label}</span>
            <span className="text-sm font-bold text-slate-900">{value}</span>
          </div>
        ))}
      </div>
    </article>
  );
}

function Panel({
  title,
  detail,
  action,
  onAction,
  children,
}: {
  title: string;
  detail: string;
  action: string;
  onAction: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h2 className="font-bold">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
        <button
          type="button"
          onClick={onAction}
          className="shrink-0 text-sm font-semibold text-indigo-700 hover:text-indigo-800"
        >
          {action}
        </button>
      </div>
      {children}
    </section>
  );
}

function DataPanel({
  title,
  detail,
  search,
  onSearch,
  searchLabel,
  placeholder,
  footer,
  extra,
  children,
}: {
  title: string;
  detail: string;
  search: string;
  onSearch: (value: string) => void;
  searchLabel: string;
  placeholder: string;
  footer: string;
  extra?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 className="text-lg font-bold">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{detail}</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <input
            type="search"
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder={placeholder}
            aria-label={searchLabel}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64"
          />
          {extra}
        </div>
      </div>
      {children}
      <div className="border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:px-6">
        {footer}
      </div>
    </section>
  );
}

function EmptyCopy({ message }: { message: string }) {
  return <p className="py-8 text-sm text-slate-500">{message}</p>;
}

function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: string;
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="px-6 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">
        {icon}
      </div>
      <h3 className="mt-4 font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {message}
      </p>
      {action}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "good" | "muted" | "bad" | "info";
  children: ReactNode;
}) {
  const tones = {
    good: "bg-emerald-50 text-emerald-700",
    muted: "bg-slate-100 text-slate-600",
    bad: "bg-rose-50 text-rose-700",
    info: "bg-indigo-50 text-indigo-700",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}
