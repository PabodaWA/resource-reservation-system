"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

export type AdminDashboardData = {
  admin: {
    id: string;
    name: string;
    email: string;
  };
  users: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    isActive: boolean;
    createdAt: string;
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
  }[];
  reservations: {
    id: string;
    title: string;
    purpose: string | null;
    startTime: string;
    endTime: string;
    status: "CONFIRMED" | "CANCELLED";
    timing: "upcoming" | "in_progress" | "past";
    resourceId: string;
    userName: string;
    userEmail: string;
    resourceName: string;
    resourceType: string;
    resourceLocation: string;
  }[];
};

type Section = "dashboard" | "users" | "resources" | "reservations";
type ReservationFilter = "upcoming" | "past" | "cancelled";

const sections: { id: Section; label: string; icon: string }[] = [
  { id: "dashboard", label: "Dashboard", icon: "▦" },
  { id: "users", label: "Add users", icon: "☺" },
  { id: "resources", label: "Add resources", icon: "▤" },
  { id: "reservations", label: "Reservations", icon: "▣" },
];

const sectionCopy: Record<Section, { kicker: string; title: string }> = {
  dashboard: { kicker: "Administration", title: "Dashboard" },
  users: { kicker: "Administration", title: "Add users" },
  resources: { kicker: "Administration", title: "Add resources" },
  reservations: { kicker: "Administration", title: "Reservations" },
};

const resourceTypes = [
  { value: "MEETING_ROOM", label: "Meeting room" },
  { value: "CONFERENCE_ROOM", label: "Conference room" },
  { value: "DESK", label: "Desk" },
  { value: "PROJECTOR", label: "Projector" },
  { value: "VEHICLE", label: "Vehicle" },
  { value: "OTHER", label: "Other" },
];

const typeLabels = Object.fromEntries(
  resourceTypes.map((type) => [type.value, type.label])
);

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const emptyUser = {
  name: "",
  email: "",
  password: "",
  role: "MEMBER" as "ADMIN" | "MEMBER",
};

const emptyResource = {
  name: "",
  type: "MEETING_ROOM",
  location: "",
  capacity: "1",
  description: "",
};

export default function AdminDashboardClient({
  data,
}: {
  data: AdminDashboardData;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("dashboard");
  const [userForm, setUserForm] = useState(emptyUser);
  const [resourceForm, setResourceForm] = useState(emptyResource);
  const [userSearch, setUserSearch] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [reservationFilter, setReservationFilter] =
    useState<ReservationFilter>("upcoming");
  const [savingUser, setSavingUser] = useState(false);
  const [savingResource, setSavingResource] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const firstName = data.admin.name.trim().split(/\s+/)[0] || "Admin";
  const activeResources = data.resources.filter(
    (resource) => resource.status === "ACTIVE"
  );
  const confirmed = data.reservations.filter(
    (reservation) => reservation.status === "CONFIRMED"
  );
  const upcomingCount = confirmed.filter(
    (reservation) => reservation.timing !== "past"
  ).length;
  const dashboardReservations = [
    ...confirmed.filter((reservation) => reservation.timing === "in_progress"),
    ...confirmed
      .filter((reservation) => reservation.timing === "upcoming")
      .sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      ),
  ].slice(0, 5);

  const visibleUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();

    return data.users.filter((user) => {
      if (!term) {
        return true;
      }

      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        user.role.toLowerCase().includes(term)
      );
    });
  }, [data.users, userSearch]);

  const visibleResources = useMemo(() => {
    const term = resourceSearch.trim().toLowerCase();

    return data.resources.filter((resource) => {
      if (!term) {
        return true;
      }

      return (
        resource.name.toLowerCase().includes(term) ||
        labelType(resource.type).toLowerCase().includes(term) ||
        resource.location.toLowerCase().includes(term)
      );
    });
  }, [data.resources, resourceSearch]);

  const visibleReservations = useMemo(() => {
    const term = reservationSearch.trim().toLowerCase();

    return data.reservations.filter((reservation) => {
      if (reservationFilter === "cancelled") {
        if (reservation.status !== "CANCELLED") {
          return false;
        }
      } else if (reservation.status !== "CONFIRMED") {
        return false;
      } else if (reservationFilter === "past") {
        if (reservation.timing !== "past") {
          return false;
        }
      } else if (reservation.timing === "past") {
        return false;
      }

      if (!term) {
        return true;
      }

      return (
        reservation.title.toLowerCase().includes(term) ||
        reservation.userName.toLowerCase().includes(term) ||
        reservation.userEmail.toLowerCase().includes(term) ||
        reservation.resourceName.toLowerCase().includes(term)
      );
    });
  }, [data.reservations, reservationFilter, reservationSearch]);

  function openSection(next: Section) {
    setError("");
    setSuccess("");
    setSection(next);
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

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = userForm.name.trim();
    const email = userForm.email.trim();
    const password = userForm.password;

    if (!name || name.length > 120) {
      setError("Name must be between 1 and 120 characters.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (password.length < 12 || password.length > 128) {
      setError("Temporary password must contain 12–128 characters.");
      return;
    }

    setSavingUser(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          password,
          role: userForm.role,
        }),
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to create this user.");
      }

      setSuccess(
        `Created ${name}. Temporary password: ${password}. They must change it at first login.`
      );
      setUserForm(emptyUser);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = resourceForm.name.trim();
    const location = resourceForm.location.trim();
    const description = resourceForm.description.trim();
    const capacity = Number(resourceForm.capacity);

    if (!name || name.length > 120) {
      setError("Resource name must be between 1 and 120 characters.");
      return;
    }

    if (!location || location.length > 160) {
      setError("Location must be between 1 and 160 characters.");
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
      setError("Capacity must be a whole number between 1 and 10000.");
      return;
    }

    if (description.length > 1000) {
      setError("Description must be 1000 characters or fewer.");
      return;
    }

    setSavingResource(true);

    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type: resourceForm.type,
          location,
          capacity,
          description: description || null,
        }),
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to add this resource.");
      }

      setSuccess(`${name} is now available to book.`);
      setResourceForm(emptyResource);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingResource(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-6 md:flex">
          <button
            type="button"
            onClick={() => openSection("dashboard")}
            className="flex items-center gap-3 text-left"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
              R
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">ReserveFlow</p>
              <p className="text-xs text-slate-500">Admin dashboard</p>
            </div>
          </button>

          <p className="mb-3 mt-10 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Menu
          </p>

          <nav className="space-y-2">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openSection(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left font-semibold transition ${
                  section === item.id
                    ? "bg-indigo-50 text-indigo-700"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                <span>{item.icon}</span>
                {item.label}
              </button>
            ))}
          </nav>

          <div className="mt-auto rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">Workspace totals</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {data.users.length} users · {data.resources.length} resources ·{" "}
              {upcomingCount} active bookings
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

            {section === "dashboard" && (
              <>
                <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 to-violet-600 p-6 text-white shadow-sm sm:p-9">
                  <div className="relative z-10 max-w-2xl">
                    <p className="text-sm font-medium text-indigo-100">
                      ADMIN DASHBOARD
                    </p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                      Welcome back, {firstName}.
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
                      See who can sign in, which resources are available, and
                      which bookings are coming up.
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openSection("users")}
                        className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                      >
                        Add a user
                      </button>
                      <button
                        type="button"
                        onClick={() => openSection("resources")}
                        className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        Add a resource
                      </button>
                      <button
                        type="button"
                        onClick={() => openSection("reservations")}
                        className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        View reservations
                      </button>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
                  <div className="pointer-events-none absolute -bottom-24 right-36 h-48 w-48 rounded-full bg-white/10" />
                </section>

                <section
                  aria-label="Admin summary"
                  className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                >
                  <StatCard
                    label="Users"
                    value={data.users.length}
                    detail={`${data.users.filter((user) => user.role === "ADMIN").length} administrators`}
                    icon="☺"
                    color="indigo"
                  />
                  <StatCard
                    label="Resources"
                    value={data.resources.length}
                    detail={`${activeResources.length} active`}
                    icon="▤"
                    color="amber"
                  />
                  <StatCard
                    label="Active bookings"
                    value={upcomingCount}
                    detail={`${data.reservations.length} reservations in total`}
                    icon="▣"
                    color="emerald"
                  />
                </section>

                <section className="grid gap-4 lg:grid-cols-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold">Upcoming bookings</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Confirmed reservations that are still ahead.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setReservationFilter("upcoming");
                          openSection("reservations");
                        }}
                        className="text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                      >
                        See all
                      </button>
                    </div>
                    {dashboardReservations.length === 0 ? (
                      <EmptyState
                        title="No upcoming reservations"
                        detail="Bookings will show up here."
                      />
                    ) : (
                      <ul className="mt-5 space-y-3">
                        {dashboardReservations.map((reservation) => (
                          <li
                            key={reservation.id}
                            className="rounded-xl border border-slate-100 px-4 py-3"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="truncate font-semibold text-slate-800">
                                  {reservation.title}
                                </p>
                                <p className="mt-1 truncate text-sm text-slate-600">
                                  {reservation.userName} · {reservation.resourceName}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  {formatRange(
                                    reservation.startTime,
                                    reservation.endTime
                                  )}
                                </p>
                              </div>
                              <Badge
                                tone={
                                  reservation.timing === "in_progress"
                                    ? "success"
                                    : "info"
                                }
                              >
                                {reservation.timing === "in_progress"
                                  ? "In progress"
                                  : "Upcoming"}
                              </Badge>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="space-y-4 lg:col-span-2">
                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold">People</h2>
                        <button
                          type="button"
                          onClick={() => openSection("users")}
                          className="text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                        >
                          Manage
                        </button>
                      </div>
                      {data.users.length === 0 ? (
                        <EmptyState
                          title="No users yet"
                          detail="Add someone who can sign in."
                        />
                      ) : (
                        <ul className="mt-4 space-y-3">
                          {data.users.slice(0, 4).map((user) => (
                            <li
                              key={user.id}
                              className="flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {user.name}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {user.email}
                                </p>
                              </div>
                              <Badge tone={user.role === "ADMIN" ? "info" : "muted"}>
                                {user.role === "ADMIN" ? "Admin" : "Member"}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <div className="flex items-center justify-between gap-3">
                        <h2 className="text-lg font-bold">Resources</h2>
                        <button
                          type="button"
                          onClick={() => openSection("resources")}
                          className="text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                        >
                          Manage
                        </button>
                      </div>
                      {data.resources.length === 0 ? (
                        <EmptyState
                          title="No resources yet"
                          detail="Add a room, desk, or piece of equipment."
                        />
                      ) : (
                        <ul className="mt-4 space-y-3">
                          {data.resources.slice(0, 4).map((resource) => (
                            <li
                              key={resource.id}
                              className="flex items-center justify-between gap-3"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-slate-800">
                                  {resource.name}
                                </p>
                                <p className="truncate text-xs text-slate-500">
                                  {labelType(resource.type)} · {resource.location}
                                </p>
                              </div>
                              <Badge
                                tone={
                                  resource.status === "ACTIVE" ? "success" : "muted"
                                }
                              >
                                {resource.status === "ACTIVE" ? "Active" : "Inactive"}
                              </Badge>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                </section>
              </>
            )}

            {section === "users" && (
              <section className="grid gap-4 lg:grid-cols-5">
                <form
                  onSubmit={(event) => void handleCreateUser(event)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2"
                >
                  <h2 className="text-lg font-bold">New user</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    They sign in with this temporary password, then choose
                    their own.
                  </p>

                  <label className="mt-5 block text-sm font-medium text-slate-700">
                    Full name
                    <input
                      required
                      value={userForm.name}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      maxLength={120}
                      className={`${inputClass} mt-2`}
                      placeholder="Alex Fernando"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Email
                    <input
                      required
                      type="email"
                      value={userForm.email}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      maxLength={254}
                      autoComplete="off"
                      className={`${inputClass} mt-2`}
                      placeholder="alex@example.com"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Role
                    <select
                      value={userForm.role}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          role: event.target.value === "ADMIN" ? "ADMIN" : "MEMBER",
                        }))
                      }
                      className={`${inputClass} mt-2`}
                    >
                      <option value="MEMBER">Member</option>
                      <option value="ADMIN">Administrator</option>
                    </select>
                  </label>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Temporary password
                    <input
                      required
                      value={userForm.password}
                      onChange={(event) =>
                        setUserForm((current) => ({
                          ...current,
                          password: event.target.value,
                        }))
                      }
                      minLength={12}
                      maxLength={128}
                      autoComplete="new-password"
                      className={`${inputClass} mt-2 font-mono`}
                      placeholder="At least 12 characters"
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      setUserForm((current) => ({
                        ...current,
                        password: createTemporaryPassword(),
                      }))
                    }
                    className="mt-3 text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                  >
                    Generate a temporary password
                  </button>

                  <button
                    type="submit"
                    disabled={savingUser}
                    className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingUser ? "Creating user..." : "Add user"}
                  </button>
                </form>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">People</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Accounts that can sign in.
                      </p>
                    </div>
                    <input
                      value={userSearch}
                      onChange={(event) => setUserSearch(event.target.value)}
                      placeholder="Search name, email, or role"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64"
                    />
                  </div>

                  {visibleUsers.length === 0 ? (
                    <EmptyState
                      title="No users match"
                      detail="Add a user, or try another search."
                    />
                  ) : (
                    <ul className="mt-5 divide-y divide-slate-100">
                      {visibleUsers.map((user) => (
                        <li
                          key={user.id}
                          className="flex items-center justify-between gap-3 py-3"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-800">
                              {user.name}
                            </p>
                            <p className="mt-1 truncate text-xs text-slate-500">
                              {user.email}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <Badge tone={user.role === "ADMIN" ? "info" : "muted"}>
                              {user.role === "ADMIN" ? "Admin" : "Member"}
                            </Badge>
                            <Badge tone={user.isActive ? "success" : "muted"}>
                              {user.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            {section === "resources" && (
              <section className="grid gap-4 lg:grid-cols-5">
                <form
                  onSubmit={(event) => void handleCreateResource(event)}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2"
                >
                  <h2 className="text-lg font-bold">New resource</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Active resources appear on the booking page right away.
                  </p>

                  <label className="mt-5 block text-sm font-medium text-slate-700">
                    Name
                    <input
                      required
                      value={resourceForm.name}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          name: event.target.value,
                        }))
                      }
                      maxLength={120}
                      className={`${inputClass} mt-2`}
                      placeholder="Boardroom A"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Type
                    <select
                      value={resourceForm.type}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          type: event.target.value,
                        }))
                      }
                      className={`${inputClass} mt-2`}
                    >
                      {resourceTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Location
                    <input
                      required
                      value={resourceForm.location}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          location: event.target.value,
                        }))
                      }
                      maxLength={160}
                      className={`${inputClass} mt-2`}
                      placeholder="2nd floor, west wing"
                    />
                  </label>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Capacity
                    <input
                      required
                      type="number"
                      min={1}
                      max={10000}
                      step={1}
                      value={resourceForm.capacity}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          capacity: event.target.value,
                        }))
                      }
                      className={`${inputClass} mt-2`}
                    />
                  </label>

                  <label className="mt-4 block text-sm font-medium text-slate-700">
                    Description
                    <textarea
                      value={resourceForm.description}
                      onChange={(event) =>
                        setResourceForm((current) => ({
                          ...current,
                          description: event.target.value,
                        }))
                      }
                      maxLength={1000}
                      rows={3}
                      className={`${inputClass} mt-2 resize-y`}
                      placeholder="Optional details members should know"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={savingResource}
                    className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                  >
                    {savingResource ? "Adding resource..." : "Add resource"}
                  </button>
                </form>

                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-3">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">Resources</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Rooms, desks, and equipment members can reserve.
                      </p>
                    </div>
                    <input
                      value={resourceSearch}
                      onChange={(event) => setResourceSearch(event.target.value)}
                      placeholder="Search name, type, or location"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64"
                    />
                  </div>

                  {visibleResources.length === 0 ? (
                    <EmptyState
                      title="No resources yet"
                      detail="Add a resource and members can book it."
                    />
                  ) : (
                    <ul className="mt-5 space-y-3">
                      {visibleResources.map((resource) => (
                        <li
                          key={resource.id}
                          className="rounded-xl border border-slate-100 px-4 py-3"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {resource.name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {labelType(resource.type)} · {resource.location} ·
                                capacity {resource.capacity}
                              </p>
                              {resource.description && (
                                <p className="mt-2 text-sm text-slate-600">
                                  {resource.description}
                                </p>
                              )}
                            </div>
                            <Badge
                              tone={
                                resource.status === "ACTIVE" ? "success" : "muted"
                              }
                            >
                              {resource.status === "ACTIVE" ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </section>
            )}

            {section === "reservations" && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h2 className="text-lg font-bold">All reservations</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Every booking, including who reserved it and which resource.
                      </p>
                    </div>
                    <input
                      value={reservationSearch}
                      onChange={(event) => setReservationSearch(event.target.value)}
                      placeholder="Search title, person, or resource"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64"
                    />
                  </div>

                  <div className="mt-4 flex gap-2">
                    {(
                      [
                        ["upcoming", "Upcoming"],
                        ["past", "Past"],
                        ["cancelled", "Cancelled"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setReservationFilter(id)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                          reservationFilter === id
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {visibleReservations.length === 0 ? (
                    <EmptyState
                      title="No reservations here"
                      detail="Bookings that match this filter will show up here."
                    />
                  ) : (
                    <ul className="mt-5 space-y-3">
                      {visibleReservations.map((reservation) => (
                        <li
                          key={reservation.id}
                          className="rounded-xl border border-slate-100 px-4 py-4"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-semibold text-slate-800">
                                {reservation.title}
                              </p>
                              <p className="mt-1 text-sm text-slate-600">
                                {reservation.userName} · {reservation.userEmail}
                              </p>
                              <p className="mt-1 text-sm text-slate-500">
                                {reservation.resourceName} ·{" "}
                                {labelType(reservation.resourceType)} ·{" "}
                                {reservation.resourceLocation}
                              </p>
                              <p className="mt-2 text-sm text-slate-700">
                                {formatRange(
                                  reservation.startTime,
                                  reservation.endTime
                                )}
                              </p>
                              {reservation.purpose && (
                                <p className="mt-2 text-sm text-slate-500">
                                  {reservation.purpose}
                                </p>
                              )}
                            </div>
                            <Badge
                              tone={
                                reservation.status === "CANCELLED"
                                  ? "muted"
                                  : reservation.timing === "in_progress"
                                    ? "success"
                                    : "info"
                              }
                            >
                              {reservation.status === "CANCELLED"
                                ? "Cancelled"
                                : reservation.timing === "in_progress"
                                  ? "In progress"
                                  : reservation.timing === "past"
                                    ? "Completed"
                                    : "Upcoming"}
                            </Badge>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            )}
          </div>
        </main>
      </div>
    </div>
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
  color: "indigo" | "emerald" | "amber";
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
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
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-lg font-bold ${colors[color]}`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

function Badge({
  children,
  tone,
}: {
  children: string;
  tone: "info" | "success" | "muted";
}) {
  const tones = {
    info: "bg-indigo-50 text-indigo-700",
    success: "bg-emerald-50 text-emerald-700",
    muted: "bg-slate-100 text-slate-600",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{detail}</p>
    </div>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "A";
}

function labelType(type: string) {
  return (
    typeLabels[type] ??
    type
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  );
}

function createTemporaryPassword() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const values = new Uint32Array(14);
  crypto.getRandomValues(values);
  return `Rf-${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
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
