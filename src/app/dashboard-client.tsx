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
import {
  ParticipantInputError,
  assertParticipantCapacity,
  minimumPartySize,
  parseParticipants,
} from "@/lib/reservation-participants";

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
    participants: {
      name: string;
      email: string;
    }[];
  }[];
  occupiedSlots: {
    resourceId: string;
    startTime: string;
    endTime: string;
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
  category: "",
  date: "",
  startClock: "",
  endClock: "",
};

type ParticipantDraft = {
  name: string;
  email: string;
};

function emptyParty(capacity: number): ParticipantDraft[] {
  const others = Math.max(minimumPartySize(capacity) - 1, 0);

  return Array.from({ length: others }, () => ({ name: "", email: "" }));
}

function formatClockLabel(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes, 0, 0));
}

const timeChoices = Array.from({ length: 24 * 4 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return { value, label: formatClockLabel(value) };
});

const MIN_DURATION_MS = 15 * 60 * 1000;
const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
const MAX_LEAD_MS = 90 * 24 * 60 * 60 * 1000;

export default function DashboardClient({
  data,
}: {
  data: UserDashboardData;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [filter, setFilter] = useState<ReservationFilter>("upcoming");
  const [search, setSearch] = useState("");
  const [booking, setBooking] = useState(() => ({
    ...emptyBooking,
    ...defaultSlot(),
  }));
  const [participants, setParticipants] = useState<ParticipantDraft[]>([]);
  const [notifyParticipants, setNotifyParticipants] = useState(true);
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

  const slot = useMemo(
    () => resolveSlot(booking.date, booking.startClock, booking.endClock),
    [booking.date, booking.startClock, booking.endClock]
  );

  const categories = useMemo(() => {
    const present = new Set(data.resources.map((resource) => resource.type));
    const known = Object.keys(typeLabels).filter((type) => present.has(type));
    const extra = [...present]
      .filter((type) => !typeLabels[type])
      .sort((a, b) => labelType(a).localeCompare(labelType(b)));

    return [...known, ...extra];
  }, [data.resources]);

  const availableResources = useMemo(() => {
    if (!slot.window) {
      return [];
    }

    return data.resources.filter((resource) => {
      if (booking.category && resource.type !== booking.category) {
        return false;
      }

      return isResourceFree(resource.id, slot.window!, data.occupiedSlots);
    });
  }, [booking.category, data.occupiedSlots, data.resources, slot.window]);

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
          reservation.resourceLocation.toLowerCase().includes(term) ||
          reservation.participants.some(
            (person) =>
              person.name.toLowerCase().includes(term) ||
              person.email.toLowerCase().includes(term)
          )
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

    if (next !== "book") {
      setShowBooking(false);
    }
  }

  function openBooking(resourceId = "") {
    const nextSlot = defaultSlot();
    const resolved = resolveSlot(
      nextSlot.date,
      nextSlot.startClock,
      nextSlot.endClock
    );
    const picked = data.resources.find((resource) => resource.id === resourceId);
    const free =
      Boolean(resourceId) &&
      resolved.window !== null &&
      isResourceFree(resourceId, resolved.window, data.occupiedSlots);

    setSection("book");
    setSearch("");
    setSuccess("");
    setParticipants(free ? emptyParty(picked?.capacity ?? 1) : []);
    setNotifyParticipants(true);
    setShowBooking(free);
    setBooking({
      ...emptyBooking,
      ...nextSlot,
      category: picked?.type ?? "",
      resourceId: free ? resourceId : "",
    });
    setError(
      resourceId && !free
        ? "That resource is already booked for the next open time. Change the date or time, or pick another resource."
        : ""
    );
  }

  function updateSlot(patch: Partial<Pick<typeof booking, "date" | "startClock" | "endClock">>) {
    const next = { ...booking, ...patch };
    const resolved = resolveSlot(next.date, next.startClock, next.endClock);
    const stillFree =
      Boolean(next.resourceId) &&
      resolved.window !== null &&
      isResourceFree(next.resourceId, resolved.window, data.occupiedSlots);

    if (next.resourceId && !stillFree) {
      setShowBooking(false);
      setBooking({ ...next, resourceId: "" });
      setError(
        resolved.window
          ? "That resource is not free for the selected time."
          : ""
      );
      return;
    }

    setBooking(next);
  }

  function updateCategory(category: string) {
    const selected = data.resources.find(
      (resource) => resource.id === booking.resourceId
    );

    if (selected && category && selected.type !== category) {
      setShowBooking(false);
      setBooking({ ...booking, category, resourceId: "" });
      return;
    }

    setBooking({ ...booking, category });
  }

  function chooseResource(resourceId: string) {
    if (!slot.window) {
      setError(slot.error || "Choose a valid date and time first.");
      return;
    }

    if (!isResourceFree(resourceId, slot.window, data.occupiedSlots)) {
      setError("That resource is already booked for the selected time.");
      return;
    }

    const pickedResource = data.resources.find(
      (resource) => resource.id === resourceId
    );

    setError("");
    setSuccess("");
    setParticipants(emptyParty(pickedResource?.capacity ?? 1));
    setNotifyParticipants(true);
    setBooking((current) => ({
      ...current,
      resourceId,
      title: current.resourceId === resourceId ? current.title : "",
      purpose: current.resourceId === resourceId ? current.purpose : "",
    }));
    setShowBooking(true);
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

  async function handleBook(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!booking.resourceId) {
      setError("Choose a resource to book.");
      return;
    }

    const resolved = resolveSlot(
      booking.date,
      booking.startClock,
      booking.endClock
    );

    if (!resolved.window) {
      setError(resolved.error || "Choose a valid date and time.");
      return;
    }

    if (
      !isResourceFree(
        booking.resourceId,
        resolved.window,
        data.occupiedSlots
      )
    ) {
      setShowBooking(false);
      setBooking((current) => ({ ...current, resourceId: "" }));
      setError("That resource is already booked for the selected time.");
      return;
    }

    const start = resolved.window.start;
    const end = resolved.window.end;
    const bookedResource = data.resources.find(
      (resource) => resource.id === booking.resourceId
    );

    if (!bookedResource) {
      setError("Choose a resource to book.");
      return;
    }

    let filledPeople: { name: string; email: string }[];

    try {
      filledPeople = parseParticipants(participants);
      assertParticipantCapacity(
        bookedResource.capacity,
        filledPeople,
        data.user.email
      );
    } catch (error) {
      if (error instanceof ParticipantInputError) {
        setError(error.message);
        return;
      }

      throw error;
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
          participants: filledPeople.map((person) => ({
            name: person.name.trim().replace(/\s+/g, " "),
            email: person.email.trim().toLowerCase(),
          })),
          notifyParticipants: notifyParticipants && filledPeople.length > 0,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to book that resource.");
      }

      setBooking({ ...emptyBooking, ...defaultSlot() });
      setParticipants([]);
      setNotifyParticipants(true);
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
            <img
              src="/R%20logo.jpg"
              alt=""
              className="h-11 w-11 shrink-0 rounded-xl object-contain"
            />
            <div className="min-w-0">
              <p className="text-sm font-bold leading-snug tracking-tight">
                Ruhunu ResourceHub
              </p>
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
                <img
                  src="/R%20logo.jpg"
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-xl object-contain md:hidden"
                />
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
              {data.user.role === "ADMIN" && (
                <a
                  href="/admin"
                  className="shrink-0 rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600"
                >
                  Admin
                </a>
              )}
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
              <section className="overflow-visible rounded-2xl border border-slate-200 bg-[#e9ecef] shadow-sm">
                <div className="flex min-h-[36rem] flex-col lg:flex-row">
                  <aside className="w-full shrink-0 bg-[#1e3348] px-5 py-6 text-white lg:w-96">
                    <h2 className="text-lg font-semibold">Booking Details</h2>
                    <div className="my-4 h-px bg-white/25" />

                    <label className="block text-sm text-slate-200">
                      Category
                      <select
                        value={booking.category}
                        onChange={(event) => updateCategory(event.target.value)}
                        aria-label="Resource category"
                        className="mt-2 w-full rounded-md bg-white px-3 py-2.5 text-sm font-medium text-slate-800 outline-none"
                      >
                        <option value="">All categories</option>
                        {categories.map((type) => (
                          <option key={type} value={type}>
                            {labelType(type)}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="my-5 h-px bg-white/25" />

                    <BookingDateField
                      value={booking.date}
                      onChange={(date) => updateSlot({ date })}
                    />

                    <div className="my-5 h-px bg-white/25" />

                    <div>
                      <p className="text-sm text-slate-200">Time</p>
                      <div className="mt-2 flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-slate-800">
                        <select
                          required
                          value={booking.startClock}
                          onChange={(event) =>
                            updateSlot({ startClock: event.target.value })
                          }
                          aria-label="Start time"
                          className="min-w-0 flex-1 appearance-none bg-transparent py-1 text-sm font-medium outline-none"
                        >
                          {timeChoices.map((choice) => (
                            <option key={`start-${choice.value}`} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                        <span className="text-slate-400">–</span>
                        <select
                          required
                          value={booking.endClock}
                          onChange={(event) =>
                            updateSlot({ endClock: event.target.value })
                          }
                          aria-label="End time"
                          className="min-w-0 flex-1 appearance-none bg-transparent py-1 text-sm font-medium outline-none"
                        >
                          {timeChoices.map((choice) => (
                            <option key={`end-${choice.value}`} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                        <ClockIcon />
                      </div>
                      {slot.window && (
                        <p className="mt-2 text-xs text-slate-300">
                          {formatDuration(
                            slot.window.end.getTime() - slot.window.start.getTime()
                          )}
                          {booking.endClock <= booking.startClock
                            ? " · ends the next day"
                            : ""}
                        </p>
                      )}
                      {slot.error && (
                        <p className="mt-3 text-xs leading-5 text-amber-200">
                          {slot.error}
                        </p>
                      )}
                    </div>
                  </aside>

                  <div className="min-w-0 flex-1 p-5 sm:p-6">
                    <h2 className="text-base font-medium text-slate-800">
                      Select an available resource:
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {slot.window
                        ? availableResources.length === 1
                          ? "1 resource available"
                          : `${availableResources.length} resources available`
                        : "Choose a valid date and time"}
                    </p>

                    {!slot.window ? (
                      <EmptyState
                        title="Pick a date and time"
                        detail={
                          slot.error ||
                          "Set when you need the resource. Only free ones will be shown."
                        }
                      />
                    ) : availableResources.length === 0 ? (
                      <EmptyState
                        title={
                          data.resources.length === 0
                            ? "No resources available"
                            : booking.category &&
                                !data.resources.some(
                                  (resource) => resource.type === booking.category
                                )
                              ? "No resources in this category"
                              : "Nothing is free for this time"
                        }
                        detail={
                          data.resources.length === 0
                            ? "Ask an administrator to add a resource you can book."
                            : booking.category &&
                                !data.resources.some(
                                  (resource) => resource.type === booking.category
                                )
                              ? "Choose another category, or ask an administrator to add one."
                              : booking.category
                                ? `No ${labelType(booking.category).toLowerCase()} is free then. Try another time or category.`
                                : "Every resource is already booked then. Try another date or time."
                        }
                      />
                    ) : (
                      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {availableResources.map((resource) => (
                          <ResourceCard
                            key={resource.id}
                            resource={resource}
                            selected={
                              booking.resourceId === resource.id && showBooking
                            }
                            onBook={() => chooseResource(resource.id)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </section>
            )}

            {showBooking && selectedResource && section === "book" && (
              <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
                <form
                  onSubmit={handleBook}
                  className="max-h-[min(90vh,760px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h2 className="text-lg font-bold">
                        Book {selectedResource.name}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {formatBookingDate(booking.date)} · {booking.startClock}{" "}
                        – {booking.endClock}
                        {booking.endClock <= booking.startClock
                          ? " (next day)"
                          : ""}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {labelType(selectedResource.type)} · Capacity{" "}
                        {selectedResource.capacity} · {selectedResource.location}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setShowBooking(false);
                        setBooking((current) => ({
                          ...current,
                          resourceId: "",
                        }));
                      }}
                      className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
                      aria-label="Close booking form"
                    >
                      ✕
                    </button>
                  </div>

                  <div className="mt-5 space-y-4">
                    <FormField label="Title">
                      <input
                        required
                        autoFocus
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
                    {selectedResource.capacity <= 1 ? (
                      <p className="text-sm text-slate-500">
                        This resource fits one person, so the booking is only
                        for you.
                      </p>
                    ) : (
                      <ParticipantFields
                        capacity={selectedResource.capacity}
                        participants={participants}
                        notify={notifyParticipants}
                        onChange={setParticipants}
                        onNotifyChange={setNotifyParticipants}
                      />
                    )}
                  </div>

                  <div className="mt-6 flex flex-wrap justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setShowBooking(false);
                        setBooking((current) => ({
                          ...current,
                          resourceId: "",
                        }));
                      }}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Booking..." : "Confirm booking"}
                    </button>
                  </div>
                </form>
              </div>
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
              Ruhunu ResourceHub · Your reservations
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
      className={`flex h-full flex-col items-center rounded-xl bg-white px-4 py-5 text-center shadow-sm ${
        selected ? "ring-2 ring-blue-500" : ""
      }`}
    >
      <h3 className="font-semibold text-slate-800">{resource.name}</h3>
      <p className="mt-2 text-sm text-slate-600">
        Capacity={resource.capacity}
      </p>
      <p className="text-sm text-slate-600">{labelType(resource.type)}</p>
      <button
        type="button"
        onClick={onBook}
        className="mt-4 rounded-lg bg-blue-600 px-6 py-2 text-xs font-bold tracking-wide text-white shadow-sm transition hover:bg-blue-700"
      >
        BOOK
      </button>
    </article>
  );
}

function BookingDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = value ? combineLocal(value, "12:00") : null;
  const [month, setMonth] = useState(() => monthStart(selected ?? new Date()));

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const today = startOfDay(new Date());
  const latest = startOfDay(addDays(today, 90));
  const firstMonth = monthStart(today);
  const lastMonth = monthStart(latest);
  const days = calendarDays(month);

  const summary = dateSummary(value);

  return (
    <div ref={rootRef} className="relative">
      <p className="text-sm text-slate-200">Date</p>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Choose a date from the calendar"
        onClick={() => {
          if (!open) {
            setMonth(monthStart(selected ?? new Date()));
          }
          setOpen((current) => !current);
        }}
        className={`mt-2 flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2 text-left text-slate-800 ${
          open ? "ring-2 ring-blue-300" : ""
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {summary.title}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {summary.detail}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <CalendarIcon />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              disabled={month.getTime() <= firstMonth.getTime()}
              onClick={() => setMonth(addMonths(month, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <ChevronIcon direction="left" />
            </button>
            <p className="text-sm font-semibold">
              {new Intl.DateTimeFormat("en-US", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              disabled={month.getTime() >= lastMonth.getTime()}
              onClick={() => setMonth(addMonths(month, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
              <span key={label} className="flex h-8 items-center justify-center">
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="h-9" />;
              }

              const key = toDateInput(day);
              const disabled = day < today || day > latest;
              const isSelected = value === key;
              const isToday = toDateInput(today) === key;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  }).format(day)}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                    isSelected
                      ? "bg-blue-600 font-semibold text-white"
                      : disabled
                        ? "cursor-not-allowed text-slate-300"
                        : isToday
                          ? "font-semibold text-blue-700 ring-1 ring-blue-500 hover:bg-blue-50"
                          : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(toDateInput(today));
                setMonth(firstMonth);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Today
            </button>
            <p className="text-[11px] text-slate-400">Next 90 days</p>
          </div>
        </div>
      )}
    </div>
  );
}

function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d={direction === "left" ? "M14.5 6.5 9 12l5.5 5.5" : "M9.5 6.5 15 12l-5.5 5.5"}
      />
    </svg>
  );
}

function dateSummary(value: string) {
  if (!value) {
    return { title: "Select a date", detail: "Choose an upcoming day" };
  }

  const day = startOfDay(combineLocal(value, "12:00"));
  const today = startOfDay(new Date());
  const diff = Math.round((day.getTime() - today.getTime()) / 86400000);
  const title = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(day);

  if (diff === 0) {
    return { title, detail: "Today" };
  }

  if (diff === 1) {
    return { title, detail: "Tomorrow" };
  }

  if (diff > 1) {
    return { title, detail: `In ${diff} days` };
  }

  return { title, detail: "Past date" };
}

function ClockIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-blue-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </svg>
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
        {reservation.participants.length > 0 && (
          <p className="mt-2 text-sm text-slate-500">
            With{" "}
            {reservation.participants.map((person) => person.name).join(", ")}
          </p>
        )}
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

function ParticipantFields({
  capacity,
  participants,
  notify,
  onChange,
  onNotifyChange,
}: {
  capacity: number;
  participants: ParticipantDraft[];
  notify: boolean;
  onChange: (next: ParticipantDraft[]) => void;
  onNotifyChange: (next: boolean) => void;
}) {
  const extraSeats = capacity - 1;
  const minimum = minimumPartySize(capacity);
  const filled = participants.filter(
    (person) => person.name.trim() && person.email.trim()
  ).length;
  const partySize = filled + 1;
  const hasPerson = participants.some(
    (person) => person.name.trim() || person.email.trim()
  );

  function updatePerson(index: number, patch: Partial<ParticipantDraft>) {
    onChange(
      participants.map((person, personIndex) =>
        personIndex === index ? { ...person, ...patch } : person
      )
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">
          People joining you
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          You count as 1. At least {minimum} of {capacity} seats must be
          filled (70%, rounded up). Add {minimum - 1} or more people, up to{" "}
          {extraSeats}.
        </p>
        <p
          className={`text-xs font-semibold ${
            partySize >= minimum ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {partySize} of {capacity} seats filled. At least {minimum} are required.
        </p>
      </div>
      {participants.map((person, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            maxLength={80}
            value={person.name}
            onChange={(event) =>
              updatePerson(index, { name: event.target.value })
            }
            placeholder="Name"
            aria-label={`Person ${index + 1} name`}
            className={inputClass}
          />
          <input
            type="email"
            maxLength={254}
            value={person.email}
            onChange={(event) =>
              updatePerson(index, { email: event.target.value })
            }
            placeholder="Email"
            aria-label={`Person ${index + 1} email`}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() =>
              onChange(participants.filter((_, personIndex) => personIndex !== index))
            }
            className="mt-1 rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
            aria-label={`Remove person ${index + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
      {participants.length < extraSeats && (
        <button
          type="button"
          onClick={() =>
            onChange([...participants, { name: "", email: "" }])
          }
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add a person
        </button>
      )}
      {hasPerson && (
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => onNotifyChange(event.target.checked)}
            className="mt-1"
          />
          <span>
            Email them that this resource is reserved for this time.
          </span>
        </label>
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

function defaultSlot() {
  const start = new Date();
  start.setSeconds(0, 0);
  const remainder = start.getMinutes() % 30;
  start.setMinutes(start.getMinutes() + (remainder === 0 ? 30 : 30 - remainder));
  const end = new Date(start.getTime() + 30 * 60 * 1000);

  return {
    date: toDateInput(start),
    startClock: toClockInput(start),
    endClock: toClockInput(end),
  };
}

function resolveSlot(date: string, startClock: string, endClock: string) {
  if (!date || !startClock || !endClock) {
    return {
      window: null as { start: Date; end: Date } | null,
      error: "Choose a date and a start and end time.",
    };
  }

  const start = combineLocal(date, startClock);
  let end = combineLocal(date, endClock);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      window: null,
      error: "Choose a valid date and time.",
    };
  }

  if (end.getTime() <= start.getTime()) {
    end = addDays(end, 1);
  }

  const duration = end.getTime() - start.getTime();

  if (duration < MIN_DURATION_MS || duration > MAX_DURATION_MS) {
    return {
      window: null,
      error: "A booking must last between 15 minutes and 12 hours.",
    };
  }

  const now = Date.now();

  if (start.getTime() < now - 60 * 1000) {
    return {
      window: null,
      error: "Start time cannot be in the past.",
    };
  }

  if (start.getTime() > now + MAX_LEAD_MS) {
    return {
      window: null,
      error: "Bookings can be made up to 90 days ahead.",
    };
  }

  return { window: { start, end }, error: "" };
}

function isResourceFree(
  resourceId: string,
  window: { start: Date; end: Date },
  slots: UserDashboardData["occupiedSlots"]
) {
  return !slots.some((slot) => {
    if (slot.resourceId !== resourceId) {
      return false;
    }

    const start = new Date(slot.startTime);
    const end = new Date(slot.endTime);
    return start < window.end && end > window.start;
  });
}

function combineLocal(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function toDateInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toClockInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

function calendarDays(month: Date) {
  const firstWeekday = monthStart(month).getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= count; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  return cells;
}

function formatBookingDate(date: string) {
  if (!date) {
    return "Select a date";
  }

  const value = combineLocal(date, "00:00");
  const today = new Date();

  if (value.toDateString() === today.toDateString()) {
    return "Today";
  }

  const tomorrow = addDays(today, 1);

  if (value.toDateString() === tomorrow.toDateString()) {
    return "Tomorrow";
  }

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(value);
}

function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
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
