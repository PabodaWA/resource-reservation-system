"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";

export type UserDashboardData = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
  };
  resources: {
    id: string;
    name: string;
    type: string;
    location: string;
    capacity: number;
    description: string | null;
    upcomingBookings: number;
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
    resourceName: string;
    resourceType: string;
    resourceLocation: string;
  }[];
};

type Section = "overview" | "book" | "reservations";
type ReservationFilter = "upcoming" | "past" | "cancelled";

type Reservation = UserDashboardData["reservations"][number];
type Resource = UserDashboardData["resources"][number];

const sections: { id: Section; label: string; icon: string }[] = [
  { id: "overview", label: "My dashboard", icon: "▦" },
  { id: "book", label: "Book a resource", icon: "▤" },
  { id: "reservations", label: "My reservations", icon: "▣" },
];

const sectionCopy: Record<Section, { kicker: string; title: string }> = {
  overview: { kicker: "Your workspace", title: "My dashboard" },
  book: { kicker: "Your workspace", title: "Book a resource" },
  reservations: { kicker: "Your workspace", title: "My reservations" },
};

const typeLabels: Record<string, string> = {
  MEETING_ROOM: "Meeting room",
  CONFERENCE_ROOM: "Conference room",
  DESK: "Desk",
  PROJECTOR: "Projector",
  VEHICLE: "Vehicle",
  OTHER: "Other",
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

const emptyBooking = {
  resourceId: "",
  title: "",
  purpose: "",
  startTime: "",
  endTime: "",
};

export default function DashboardClient({
  data,
}: {
  data: UserDashboardData;
}) {
  const router = useRouter();
  const bookingFormRef = useRef<HTMLElement>(null);
  const [section, setSection] = useState<Section>("overview");
  const [filter, setFilter] = useState<ReservationFilter>("upcoming");
  const [search, setSearch] = useState("");
  const [booking, setBooking] = useState(emptyBooking);
  const [showBooking, setShowBooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [cancellingId, setCancellingId] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const firstName = data.user.name.trim().split(/\s+/)[0] || "there";
  const activeReservations = data.reservations.filter(
    (reservation) =>
      reservation.status === "CONFIRMED" && reservation.timing !== "past"
  );
  const inProgress = activeReservations.filter(
    (reservation) => reservation.timing === "in_progress"
  );
  const upcoming = activeReservations
    .filter((reservation) => reservation.timing === "upcoming")
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  const nextReservation = inProgress[0] ?? upcoming[0] ?? null;
  const pastCount = data.reservations.filter(
    (reservation) =>
      reservation.status === "CONFIRMED" && reservation.timing === "past"
  ).length;

  const filteredResources = useMemo(() => {
    const term = search.trim().toLowerCase();

    if (!term) {
      return data.resources;
    }

    return data.resources.filter((resource) => {
      return (
        resource.name.toLowerCase().includes(term) ||
        labelType(resource.type).toLowerCase().includes(term) ||
        resource.location.toLowerCase().includes(term)
      );
    });
  }, [data.resources, search]);

  const visibleReservations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return data.reservations
      .filter((reservation) => {
        if (filter === "cancelled") {
          return reservation.status === "CANCELLED";
        }

        if (reservation.status !== "CONFIRMED") {
          return false;
        }

        if (filter === "past") {
          return reservation.timing === "past";
        }

        return reservation.timing !== "past";
      })
      .filter((reservation) => {
        if (!term) {
          return true;
        }

        return (
          reservation.title.toLowerCase().includes(term) ||
          reservation.resourceName.toLowerCase().includes(term) ||
          reservation.resourceLocation.toLowerCase().includes(term)
        );
      })
      .sort((a, b) => {
        const aTime = new Date(a.startTime).getTime();
        const bTime = new Date(b.startTime).getTime();
        return filter === "upcoming" ? aTime - bTime : bTime - aTime;
      });
  }, [data.reservations, filter, search]);

  function openSection(next: Section) {
    setSection(next);
    setSearch("");
    setError("");
    setSuccess("");
  }

  function openBooking(resourceId = "") {
    const slot = defaultWindow();
    setSection("book");
    setSearch("");
    setError("");
    setSuccess("");
    setShowBooking(true);
    setBooking({
      ...emptyBooking,
      resourceId,
      startTime: slot.start,
      endTime: slot.end,
    });
  }

  useEffect(() => {
    if (section === "book" && showBooking) {
      bookingFormRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  }, [section, showBooking, booking.resourceId]);

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

  async function handleBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!booking.resourceId) {
      setError("Choose a resource to book.");
      return;
    }

    const start = new Date(booking.startTime);
    const end = new Date(booking.endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      setError("Choose a valid start and end time.");
      return;
    }

    if (end.getTime() <= start.getTime()) {
      setError("End time must be after the start time.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resourceId: booking.resourceId,
          title: booking.title,
          purpose: booking.purpose,
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        }),
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to book that resource.");
      }

      setBooking(emptyBooking);
      setShowBooking(false);
      setSearch("");
      setFilter("upcoming");
      setSection("reservations");
      setSuccess("Your reservation is booked.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel(reservation: Reservation) {
    const confirmed = window.confirm(
      `Cancel “${reservation.title}” for ${reservation.resourceName}?`
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setSuccess("");
    setCancellingId(reservation.id);

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "CANCELLED" }),
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to cancel this reservation.");
      }

      setSuccess("Reservation cancelled.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCancellingId("");
    }
  }

  const selectedResource = data.resources.find(
    (resource) => resource.id === booking.resourceId
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-6 md:flex">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
              R
            </div>
            <div>
              <p className="text-xl font-bold tracking-tight">ReserveFlow</p>
              <p className="text-xs text-slate-500">Your bookings</p>
            </div>
          </a>

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
            {data.user.role === "ADMIN" && (
              <a
                href="/admin"
                className="flex items-center gap-3 rounded-xl px-4 py-3 font-semibold text-slate-600 transition hover:bg-slate-100"
              >
                <span>◉</span>
                Admin workspace
              </a>
            )}
          </nav>

          <div className="mt-auto rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">
              {nextReservation ? "Coming up" : "Nothing booked"}
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {nextReservation
                ? `${nextReservation.title} · ${nextReservation.resourceName}`
                : "Pick a resource and reserve a time that works for you."}
            </p>
            <button
              type="button"
              onClick={() => openBooking()}
              className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Book a resource
            </button>
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
                  <p className="text-sm font-semibold">{data.user.name}</p>
                  <p className="text-xs text-slate-500">{data.user.email}</p>
                </div>
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">
                  {initials(data.user.name)}
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
                  <div className="relative z-10 max-w-2xl">
                    <p className="text-sm font-medium text-indigo-100">
                      MEMBER DASHBOARD
                    </p>
                    <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                      Welcome back, {firstName}.
                    </h2>
                    <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
                      {nextReservation
                        ? nextReservation.timing === "in_progress"
                          ? `${nextReservation.title} is happening now in ${nextReservation.resourceName}.`
                          : `Next up: ${nextReservation.title} in ${nextReservation.resourceName}.`
                        : "You have no upcoming bookings. Reserve a room, desk, or piece of equipment when you need it."}
                    </p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button
                        type="button"
                        onClick={() => openBooking()}
                        className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                      >
                        Book a resource
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFilter("upcoming");
                          openSection("reservations");
                        }}
                        className="rounded-xl border border-white/30 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                      >
                        View my reservations
                      </button>
                    </div>
                  </div>
                  <div className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
                  <div className="pointer-events-none absolute -bottom-24 right-36 h-48 w-48 rounded-full bg-white/10" />
                </section>

                <section
                  aria-label="Your booking summary"
                  className="grid grid-cols-1 gap-4 sm:grid-cols-3"
                >
                  <StatCard
                    label="Upcoming"
                    value={upcoming.length}
                    detail="Confirmed bookings still ahead"
                    icon="▣"
                    color="indigo"
                  />
                  <StatCard
                    label="Happening now"
                    value={inProgress.length}
                    detail="Reservations in progress"
                    icon="●"
                    color="emerald"
                  />
                  <StatCard
                    label="Available to book"
                    value={data.resources.length}
                    detail={`${pastCount} completed bookings`}
                    icon="▤"
                    color="amber"
                  />
                </section>

                <section className="grid gap-4 lg:grid-cols-5">
                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-bold">Upcoming bookings</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Your next confirmed reservations.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setFilter("upcoming");
                          openSection("reservations");
                        }}
                        className="text-sm font-semibold text-indigo-700 hover:text-indigo-800"
                      >
                        See all
                      </button>
                    </div>

                    {activeReservations.length === 0 ? (
                      <EmptyState
                        title="No upcoming reservations"
                        detail="Book a resource and it will show up here."
                        actionLabel="Book a resource"
                        onAction={() => openBooking()}
                      />
                    ) : (
                      <ul className="mt-5 space-y-3">
                        {[...inProgress, ...upcoming].slice(0, 4).map((reservation) => (
                          <ReservationRow
                            key={reservation.id}
                            reservation={reservation}
                            cancelling={cancellingId === reservation.id}
                            onCancel={() => void handleCancel(reservation)}
                          />
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6 lg:col-span-2">
                    <h2 className="text-lg font-bold">Ready to book</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Active resources you can reserve.
                    </p>
                    {data.resources.length === 0 ? (
                      <EmptyState
                        title="Nothing is available yet"
                        detail="An administrator needs to add a resource before you can book."
                      />
                    ) : (
                      <ul className="mt-5 space-y-3">
                        {data.resources.slice(0, 4).map((resource) => (
                          <li
                            key={resource.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-slate-100 px-3 py-3"
                          >
                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-800">
                                {resource.name}
                              </p>
                              <p className="mt-1 truncate text-xs text-slate-500">
                                {labelType(resource.type)} · {resource.location}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openBooking(resource.id)}
                              className="shrink-0 rounded-lg bg-indigo-50 px-3 py-2 text-xs font-semibold text-indigo-700 hover:bg-indigo-100"
                            >
                              Book
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </section>
              </>
            )}

            {section === "book" && (
              <>
                {showBooking && (
                  <section
                    ref={bookingFormRef}
                    className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7"
                  >
                    <div className="mb-6 flex items-start justify-between gap-4">
                      <div>
                        <h2 className="text-lg font-bold">Reserve a time</h2>
                        <p className="mt-1 text-sm text-slate-500">
                          {selectedResource
                            ? `${selectedResource.name} · ${selectedResource.location}`
                            : "Choose a resource, then pick a time that is still free."}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowBooking(false)}
                        className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
                        aria-label="Close booking form"
                      >
                        ✕
                      </button>
                    </div>

                    <form onSubmit={handleBook} className="space-y-5">
                      <FormField label="Resource">
                        <select
                          required
                          value={booking.resourceId}
                          onChange={(event) =>
                            setBooking({
                              ...booking,
                              resourceId: event.target.value,
                            })
                          }
                          className={inputClass}
                        >
                          <option value="">Select a resource</option>
                          {data.resources.map((resource) => (
                            <option key={resource.id} value={resource.id}>
                              {resource.name} · {resource.location}
                            </option>
                          ))}
                        </select>
                      </FormField>

                      <div className="grid gap-5 sm:grid-cols-2">
                        <FormField label="Title">
                          <input
                            required
                            maxLength={120}
                            value={booking.title}
                            onChange={(event) =>
                              setBooking({
                                ...booking,
                                title: event.target.value,
                              })
                            }
                            placeholder="e.g. Sprint planning"
                            className={inputClass}
                          />
                        </FormField>
                        <FormField label="Purpose (optional)">
                          <input
                            maxLength={500}
                            value={booking.purpose}
                            onChange={(event) =>
                              setBooking({
                                ...booking,
                                purpose: event.target.value,
                              })
                            }
                            placeholder="What is this booking for?"
                            className={inputClass}
                          />
                        </FormField>
                        <FormField label="Starts">
                          <input
                            required
                            type="datetime-local"
                            value={booking.startTime}
                            onChange={(event) =>
                              setBooking({
                                ...booking,
                                startTime: event.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </FormField>
                        <FormField label="Ends">
                          <input
                            required
                            type="datetime-local"
                            value={booking.endTime}
                            onChange={(event) =>
                              setBooking({
                                ...booking,
                                endTime: event.target.value,
                              })
                            }
                            className={inputClass}
                          />
                        </FormField>
                      </div>

                      <p className="text-xs leading-5 text-slate-500">
                        Bookings must last 15 minutes to 12 hours, can be made
                        up to 90 days ahead, and cannot overlap a confirmed
                        reservation.
                      </p>

                      <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                        <button
                          type="button"
                          onClick={() => setShowBooking(false)}
                          className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={saving || data.resources.length === 0}
                          className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {saving ? "Booking..." : "Confirm booking"}
                        </button>
                      </div>
                    </form>
                  </section>
                )}

                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                    <div>
                      <h2 className="text-lg font-bold">Available resources</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Choose something to reserve. Only active resources are
                        shown.
                      </p>
                    </div>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search resources..."
                      aria-label="Search resources"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64"
                    />
                  </div>

                  {filteredResources.length === 0 ? (
                    <EmptyState
                      title={
                        data.resources.length === 0
                          ? "No resources available"
                          : "No matching resources"
                      }
                      detail={
                        data.resources.length === 0
                          ? "Ask an administrator to add a resource you can book."
                          : "Try another name, type, or location."
                      }
                    />
                  ) : (
                    <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6 xl:grid-cols-3">
                      {filteredResources.map((resource) => (
                        <ResourceCard
                          key={resource.id}
                          resource={resource}
                          selected={booking.resourceId === resource.id && showBooking}
                          onBook={() => openBooking(resource.id)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              </>
            )}

            {section === "reservations" && (
              <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="text-lg font-bold">My reservations</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Upcoming, completed, and cancelled bookings on your
                        account.
                      </p>
                    </div>
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search your bookings..."
                      aria-label="Search your bookings"
                      className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-64"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["upcoming", "Upcoming"],
                        ["past", "Completed"],
                        ["cancelled", "Cancelled"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setFilter(id)}
                        className={`rounded-full px-4 py-2 text-sm font-semibold ${
                          filter === id
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {visibleReservations.length === 0 ? (
                  <EmptyState
                    title="No reservations here"
                    detail={
                      filter === "upcoming"
                        ? "You do not have an upcoming booking yet."
                        : "Nothing matches this view."
                    }
                    actionLabel={filter === "upcoming" ? "Book a resource" : undefined}
                    onAction={
                      filter === "upcoming" ? () => openBooking() : undefined
                    }
                  />
                ) : (
                  <ul className="space-y-3 p-5 sm:p-6">
                    {visibleReservations.map((reservation) => (
                      <ReservationRow
                        key={reservation.id}
                        reservation={reservation}
                        cancelling={cancellingId === reservation.id}
                        onCancel={() => void handleCancel(reservation)}
                      />
                    ))}
                  </ul>
                )}
              </section>
            )}

            <footer className="pb-2 text-center text-xs text-slate-400">
              ReserveFlow · Your reservations
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

function ResourceCard({
  resource,
  selected,
  onBook,
}: {
  resource: Resource;
  selected: boolean;
  onBook: () => void;
}) {
  return (
    <article
      className={`flex h-full flex-col rounded-2xl border p-5 ${
        selected
          ? "border-indigo-300 bg-indigo-50/40"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-50 font-semibold text-indigo-700">
          {resource.name.charAt(0).toUpperCase()}
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          {labelType(resource.type)}
        </span>
      </div>
      <h3 className="mt-4 font-bold text-slate-900">{resource.name}</h3>
      <p className="mt-1 text-sm text-slate-500">{resource.location}</p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
        {resource.description || "No extra details for this resource."}
      </p>
      <p className="mt-4 text-xs font-medium text-slate-500">
        Capacity {resource.capacity}
        {resource.upcomingBookings > 0
          ? ` · ${resource.upcomingBookings} upcoming booking${
              resource.upcomingBookings === 1 ? "" : "s"
            }`
          : " · No upcoming bookings"}
      </p>
      <button
        type="button"
        onClick={onBook}
        className="mt-5 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Book this
      </button>
    </article>
  );
}

function ReservationRow({
  reservation,
  cancelling,
  onCancel,
}: {
  reservation: Reservation;
  cancelling: boolean;
  onCancel: () => void;
}) {
  const canCancel =
    reservation.status === "CONFIRMED" && reservation.timing !== "past";

  return (
    <li className="flex flex-col gap-4 rounded-2xl border border-slate-100 p-4 sm:flex-row sm:items-center">
      <DateChip iso={reservation.startTime} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{reservation.title}</p>
          <StatusBadge reservation={reservation} />
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {reservation.resourceName} · {reservation.resourceLocation}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {formatRange(reservation.startTime, reservation.endTime)}
        </p>
        {reservation.purpose && (
          <p className="mt-2 text-sm text-slate-500">{reservation.purpose}</p>
        )}
      </div>
      {canCancel && (
        <button
          type="button"
          onClick={onCancel}
          disabled={cancelling}
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 disabled:opacity-60"
        >
          {cancelling ? "Cancelling..." : "Cancel"}
        </button>
      )}
    </li>
  );
}

function StatusBadge({ reservation }: { reservation: Reservation }) {
  if (reservation.status === "CANCELLED") {
    return <Badge className="bg-slate-100 text-slate-600">Cancelled</Badge>;
  }

  if (reservation.timing === "in_progress") {
    return <Badge className="bg-emerald-50 text-emerald-700">Happening now</Badge>;
  }

  if (reservation.timing === "past") {
    return <Badge className="bg-slate-100 text-slate-600">Completed</Badge>;
  }

  return <Badge className="bg-indigo-50 text-indigo-700">Upcoming</Badge>;
}

function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      {children}
    </span>
  );
}

function DateChip({ iso }: { iso: string }) {
  const date = new Date(iso);
  const month = new Intl.DateTimeFormat("en-US", { month: "short" }).format(
    date
  );
  const day = new Intl.DateTimeFormat("en-US", { day: "numeric" }).format(date);

  return (
    <div className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-indigo-50 text-indigo-700">
      <span className="text-[10px] font-semibold uppercase tracking-wide">
        {month}
      </span>
      <span className="text-lg font-bold leading-none">{day}</span>
    </div>
  );
}

function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-2 py-10 text-center">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {detail}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
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

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "U";
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

function defaultWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 1);

  return {
    start: toLocalInput(start),
    end: toLocalInput(end),
  };
}

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
