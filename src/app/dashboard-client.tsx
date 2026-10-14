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
import { needsAdminApproval } from "@/lib/office-hours";
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
    status: "CONFIRMED" | "PENDING" | "CANCELLED";
    createdAt: string;
    updatedAt: string;
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

type Section =
  | "overview"
  | "book"
  | "reservations"
  | "notifications"
  | "profile";
type ReservationFilter = "all" | "upcoming" | "pending" | "past" | "cancelled";
type DateWindow = "all" | "today" | "week" | "month";
type BrowseSort = "az" | "za" | "capacity";
type Availability = "Available" | "Limited" | "Unavailable";

type Reservation = UserDashboardData["reservations"][number];
type Resource = UserDashboardData["resources"][number];

const sections: { id: Section | "favourites"; label: string }[] = [
  { id: "overview", label: "Dashboard" },
  { id: "book", label: "Browse Resources" },
  { id: "favourites", label: "Favourite Resources" },
  { id: "reservations", label: "My Reservations" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Profile" },
];

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
  const [filter, setFilter] = useState<ReservationFilter>("all");
  const [dateWindow, setDateWindow] = useState<DateWindow>("all");
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
  const [editingId, setEditingId] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [catalogQuery, setCatalogQuery] = useState("");
  const [browseCategory, setBrowseCategory] = useState("all");
  const [browseSort, setBrowseSort] = useState<BrowseSort>("az");
  const [menuOpen, setMenuOpen] = useState(false);
  const [favouriteIds, setFavouriteIds] = useState<string[]>([]);
  const [seenNoticeAt, setSeenNoticeAt] = useState(0);
  const [detailResourceId, setDetailResourceId] = useState("");
  const [viewReservationId, setViewReservationId] = useState("");
  const [photoIndex, setPhotoIndex] = useState(0);
  const [showFavourites, setShowFavourites] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const favoriteKey = `resourcehub-favourites:${data.user.id}`;

  const firstName = data.user.name.trim().split(/\s+/)[0] || "there";
  const activeReservations = data.reservations.filter(
    (reservation) =>
      (reservation.status === "CONFIRMED" || reservation.status === "PENDING") &&
      reservation.timing !== "past"
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
  const pastCount = data.reservations.filter(
    (reservation) =>
      reservation.status === "CONFIRMED" && reservation.timing === "past"
  ).length;
  const pendingCount = data.reservations.filter(
    (reservation) => reservation.status === "PENDING"
  ).length;
  const cancelledCount = data.reservations.filter(
    (reservation) => reservation.status === "CANCELLED"
  ).length;
  const confirmedAheadCount = data.reservations.filter(
    (reservation) =>
      reservation.status === "CONFIRMED" && reservation.timing !== "past"
  ).length;

  const slot = useMemo(
    () => resolveSlot(booking.date, booking.startClock, booking.endClock),
    [booking.date, booking.startClock, booking.endClock]
  );

  const visibleReservations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return data.reservations
      .filter((reservation) => {
        if (filter === "all") {
          return true;
        }

        if (filter === "cancelled") {
          return reservation.status === "CANCELLED";
        }

        if (filter === "pending") {
          return reservation.status === "PENDING";
        }

        if (reservation.status !== "CONFIRMED") {
          return false;
        }

        if (filter === "past") {
          return reservation.timing === "past";
        }

        return reservation.timing !== "past";
      })
      .filter((reservation) => inDateWindow(reservation.startTime, dateWindow))
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
        if (filter === "all") {
          const rank = reservationListRank(a) - reservationListRank(b);

          if (rank !== 0) {
            return rank;
          }
        }

        const aTime = new Date(a.startTime).getTime();
        const bTime = new Date(b.startTime).getTime();
        const newestFirst = filter === "past" || filter === "cancelled";
        return newestFirst ? bTime - aTime : aTime - bTime;
      });
  }, [data.reservations, filter, search, dateWindow]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(favoriteKey) || "[]");
      if (Array.isArray(stored)) {
        setFavouriteIds(stored.filter((id) => typeof id === "string"));
      }
    } catch {
      setFavouriteIds([]);
    }

    const seen = Number(localStorage.getItem(`${favoriteKey}:seen`) || 0);
    if (Number.isFinite(seen)) {
      setSeenNoticeAt(seen);
    }
  }, [favoriteKey]);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!menuRef.current?.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 });
  }, [detailResourceId]);

  function openSection(next: Section | "favourites") {
    const sectionId = next === "favourites" ? "book" : next;

    setSection(sectionId);
    setSearch("");
    setError("");
    setSuccess("");
    setMenuOpen(false);

    setDetailResourceId("");
    setViewReservationId("");
    setPhotoIndex(0);
    setShowFavourites(next === "favourites");

    if (sectionId !== "book") {
      setShowBooking(false);
    }

    if (next === "notifications") {
      const seenAt = Date.now();
      setSeenNoticeAt(seenAt);
      localStorage.setItem(`${favoriteKey}:seen`, String(seenAt));
    }
  }

  function showReservations(next: ReservationFilter) {
    setFilter(next);
    setDateWindow("all");
    openSection("reservations");
  }

  function toggleFavourite(resourceId: string) {
    setFavouriteIds((current) => {
      const next = current.includes(resourceId)
        ? current.filter((id) => id !== resourceId)
        : [...current, resourceId];
      localStorage.setItem(favoriteKey, JSON.stringify(next));
      return next;
    });
  }

  function openResourceDetail(resourceId: string) {
    const picked = data.resources.find((resource) => resource.id === resourceId);

    setSection("book");
    setCatalogQuery("");
    setSearch("");
    setError("");
    setSuccess("");
    setMenuOpen(false);
    setShowBooking(false);
    setPhotoIndex(0);
    setDetailResourceId(resourceId);
    setParticipants(emptyParty(picked?.capacity ?? 1));
    setNotifyParticipants(true);
    setBooking({
      ...emptyBooking,
      date: toDateInput(new Date()),
      startClock: "",
      endClock: "",
      title: picked?.name ?? "",
      category: picked?.type ?? "",
      resourceId,
    });
  }

  function openReservationView(reservation: Reservation) {
    setSection("reservations");
    setViewReservationId(reservation.id);
    setDetailResourceId(reservation.resourceId);
    setPhotoIndex(0);
    setShowBooking(false);
    setError("");
    setSuccess("");
    setMenuOpen(false);
  }

  function closeResourceDetail() {
    const returnToReservations = Boolean(viewReservationId);
    setDetailResourceId("");
    setViewReservationId("");
    setPhotoIndex(0);
    setShowBooking(false);
    setError("");

    if (returnToReservations) {
      setSection("reservations");
    }
  }

  function selectDetailClock(
    patch: Partial<Pick<typeof booking, "date" | "startClock" | "endClock">>
  ) {
    setError("");
    setBooking((current) => {
      const resourceId = detailResourceId || current.resourceId;
      const next = { ...current, ...patch, resourceId };

      if (
        next.startClock &&
        !openStartChoices(next.date, resourceId, data.occupiedSlots).some(
          (choice) => choice.value === next.startClock
        )
      ) {
        next.startClock = "";
        next.endClock = "";
        return next;
      }

      if (
        next.endClock &&
        !openEndChoices(
          next.date,
          next.startClock,
          resourceId,
          data.occupiedSlots
        ).some((choice) => choice.value === next.endClock)
      ) {
        next.endClock = "";
      }

      return next;
    });
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
      setDetailResourceId("");
      setPhotoIndex(0);
      setSearch("");
      setFilter("upcoming");
      setSection("reservations");
      setSuccess(payload.message || "Your reservation is booked.");
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

  function openPendingEdit(reservation: Reservation) {
    const resource = data.resources.find(
      (item) => item.id === reservation.resourceId
    );

    if (!resource) {
      setError("That resource is no longer available, so this request cannot be edited.");
      return;
    }

    setError("");
    setSuccess("");
    setEditingId(reservation.id);
  }

  async function handleEditPending(input: {
    title: string;
    purpose: string;
    startTime: string;
    endTime: string;
    participants: { name: string; email: string }[];
    notifyParticipants: boolean;
  }) {
    if (!editingId) {
      throw new Error("Choose a request to edit.");
    }

    setSavingEdit(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/reservations/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...input,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        }),
      });
      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to update this request.");
      }

      setEditingId("");
      setSuccess(payload.message || "Your request was updated.");
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  }

  const selectedResource = data.resources.find(
    (resource) => resource.id === booking.resourceId
  );
  const detailResource =
    data.resources.find((resource) => resource.id === detailResourceId) ?? null;
  const viewingReservation =
    data.reservations.find((reservation) => reservation.id === viewReservationId) ??
    null;
  const editingReservation =
    data.reservations.find(
      (reservation) =>
        reservation.id === editingId &&
        reservation.status === "PENDING" &&
        reservation.timing !== "past"
    ) ?? null;
  const editingResource = editingReservation
    ? (data.resources.find(
        (resource) => resource.id === editingReservation.resourceId
      ) ?? null)
    : null;
  const activity = buildActivity(data.reservations);
  const unreadCount = activity.filter(
    (item) => new Date(item.at).getTime() > seenNoticeAt
  ).length;
  const favouriteResources = data.resources
    .filter((resource) => favouriteIds.includes(resource.id))
    .slice(0, 4);
  const previewResources = [...data.resources]
    .sort((a, b) => {
      const rank = (resource: Resource) =>
        availabilityLabel(resource, data.occupiedSlots) === "Available" ? 0 : 1;
      return rank(a) - rank(b) || a.name.localeCompare(b.name);
    })
    .slice(0, 3);
  const resourceMatches = catalogQuery.trim()
    ? data.resources
        .filter((resource) => matchesResource(resource, catalogQuery))
        .slice(0, 6)
    : [];
  const todayInput = toDateInput(new Date());
  const latestInput = toDateInput(addDays(startOfDay(new Date()), 90));
  const upcomingList = [...inProgress, ...upcoming]
    .filter((reservation) => reservation.status === "CONFIRMED")
    .slice(0, 3);
  const fixedBrowseCategories = [
    "Meeting Room",
    "Computer Lab",
    "Equipment",
    "Event Space",
  ];
  const browseCategories = [
    "all",
    ...fixedBrowseCategories,
    ...[...new Set(data.resources.map((resource) => categoryHint(resource)))]
      .filter((label) => !fixedBrowseCategories.includes(label))
      .sort((a, b) => a.localeCompare(b)),
  ].filter(
    (category) =>
      category === "all" ||
      data.resources.some((resource) => categoryHint(resource) === category)
  );
  const browseResources = data.resources
    .filter((resource) => {
      if (showFavourites && !favouriteIds.includes(resource.id)) {
        return false;
      }

      if (browseCategory !== "all" && categoryHint(resource) !== browseCategory) {
        return false;
      }

      return matchesResource(resource, catalogQuery);
    })
    .sort((a, b) => {
      if (browseSort === "za") {
        return b.name.localeCompare(a.name);
      }

      if (browseSort === "capacity") {
        return b.capacity - a.capacity || a.name.localeCompare(b.name);
      }

      return a.name.localeCompare(b.name);
    });

  return (
    <div className="h-screen overflow-hidden bg-[#f6f8fc] font-sans text-slate-900">
      <div className="flex h-full overflow-hidden bg-[#f6f8fc]">
        <aside className="hidden w-[280px] shrink-0 flex-col overflow-y-auto border-r border-slate-100 bg-white px-4 py-6 lg:flex">
          <a href="/" className="flex items-center gap-3 px-2">
            <img
              src="/R%20logo.jpg"
              alt=""
              className="h-11 w-11 shrink-0 rounded-2xl object-contain"
            />
            <div className="min-w-0">
              <p className="truncate text-[15px] font-bold leading-tight tracking-tight text-slate-900">
                Ruhunu ResourceHub
              </p>
              <p className="mt-0.5 text-[11px] leading-4 text-slate-400">
                Resource Reservation System
              </p>
            </div>
          </a>

          <p className="mt-8 px-3 text-[11px] font-bold tracking-[0.14em] text-slate-400">
            MENU
          </p>
          <nav className="mt-3 space-y-1">
            {sections.map((item) => {
              const active =
                item.id === "favourites"
                  ? section === "book" && showFavourites
                  : item.id === "book"
                    ? section === "book" && !showFavourites
                    : section === item.id;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() =>
                    item.id === "reservations"
                      ? showReservations("all")
                      : openSection(item.id)
                  }
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold transition ${
                    active
                      ? "bg-[#e8f2ff] text-[#2f6fed]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"
                  }`}
                >
                  <NavIcon id={item.id} active={active} />
                  <span className="min-w-0 flex-1">{item.label}</span>
                  {item.id === "notifications" && unreadCount > 0 && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ff4d4f] px-1.5 text-[11px] font-bold text-white">
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
              );
            })}
            {data.user.role === "ADMIN" && (
              <a
                href="/admin"
                className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-500 transition hover:bg-slate-50 hover:text-slate-800"
              >
                <NavIcon id="admin" />
                Admin workspace
              </a>
            )}
          </nav>

          <div className="mt-auto px-2 pt-8">
            
            <SharedResourcesArt />
            <p className="mt-3 text-center text-xs font-semibold leading-5 text-slate-500">
              Shared Resources
              <br />
              Stronger Together
            </p>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex flex-col gap-3 px-4 pb-2 pt-4 sm:px-6 sm:pt-5">
            <div className="flex items-center gap-3">
              <div className="relative min-w-0 flex-1">
                <SearchIcon />
                <input
                  type="search"
                  value={catalogQuery}
                  onChange={(event) => setCatalogQuery(event.target.value)}
                  placeholder="Search resources (e.g. meeting room, projector, lab...)"
                  aria-label="Search resources"
                  className="w-full rounded-full border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-4 focus:ring-blue-100"
                />
                {catalogQuery.trim() && (
                  <div className="absolute left-0 right-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                    {resourceMatches.length === 0 ? (
                      <p className="px-4 py-3 text-sm text-slate-500">
                        No resources match that search.
                      </p>
                    ) : (
                      <ul>
                        {resourceMatches.map((resource) => (
                          <li key={resource.id}>
                            <button
                              type="button"
                              onClick={() => openResourceDetail(resource.id)}
                              className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-slate-50"
                            >
                              <ResourceVisual
                                resource={resource}
                                className="h-10 w-12"
                              />
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-800">
                                  {resource.name}
                                </span>
                                <span className="block truncate text-xs text-slate-500">
                                  {categoryHint(resource)} · {resource.location}
                                </span>
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => openSection("notifications")}
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} new`
                    : "Notifications"
                }
                className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm ring-1 ring-slate-200 hover:text-slate-800"
              >
                <BellIcon />
                {unreadCount > 0 && (
                  <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#ff4d4f] ring-2 ring-white" />
                )}
              </button>

              <div ref={menuRef} className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMenuOpen((open) => !open)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full bg-white py-1 pl-1 pr-2 shadow-sm ring-1 ring-slate-200"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-sky-200 to-blue-400 text-sm font-bold text-blue-950">
                    {initials(data.user.name)}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-sm font-semibold leading-tight text-slate-900">
                      {data.user.name}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {data.user.role === "ADMIN" ? "Admin" : "User"}
                    </span>
                  </span>
                  <ChevronIcon direction="down" />
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 z-30 mt-2 w-52 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-xl"
                  >
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => openSection("profile")}
                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Profile
                    </button>
                    <a
                      href="/change-password"
                      role="menuitem"
                      className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Change password
                    </a>
                    {data.user.role === "ADMIN" && (
                      <a
                        href="/admin"
                        role="menuitem"
                        className="block px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                      >
                        Admin workspace
                      </a>
                    )}
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => void handleLogout()}
                      disabled={loggingOut}
                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60"
                    >
                      {loggingOut ? "Logging out..." : "Log out"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto lg:hidden">
              {sections.map((item) => {
                const active =
                  item.id === "favourites"
                    ? section === "book" && showFavourites
                    : item.id === "book"
                      ? section === "book" && !showFavourites
                      : section === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() =>
                    item.id === "reservations"
                      ? showReservations("all")
                      : openSection(item.id)
                  }
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${
                      active
                        ? "bg-[#2f6fed] text-white"
                        : "bg-white text-slate-600 ring-1 ring-slate-200"
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </header>

          <div
            ref={contentRef}
            className="min-h-0 flex-1 space-y-5 overflow-y-auto px-4 pb-6 pt-2 sm:px-6 sm:pb-8"
          >
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
                <section className="overflow-hidden rounded-3xl bg-gradient-to-r from-[#e7f3ff] via-[#f3f9ff] to-[#d7ebff]">
                  <div className="grid items-center lg:grid-cols-[minmax(0,1.05fr)_minmax(260px,0.95fr)]">
                    <div className="px-6 py-7 sm:px-8 sm:py-8">
                      <p className="text-lg font-medium text-slate-700">
                        Welcome back,
                      </p>
                      <h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">
                        {firstName}! <span aria-hidden="true">👋</span>
                      </h2>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                        Find and reserve the resources you need for your
                        classes, meetings, and projects. Manage your
                        reservations and stay organized.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => openSection("book")}
                          className="inline-flex items-center gap-2 rounded-xl bg-[#3b82f6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2f74ea]"
                        >
                          <SearchMark />
                          Browse Resources
                        </button>
                        <button
                          type="button"
                          onClick={() => showReservations("all")}
                          className="inline-flex items-center gap-2 rounded-xl border border-[#bfdbfe] bg-white/80 px-4 py-2.5 text-sm font-semibold text-[#2563eb] transition hover:bg-white"
                        >
                          <CalendarGlyph className="h-4 w-4" />
                          My Reservations
                        </button>
                      </div>
                    </div>
                    <img
                      src="/banner.jpg"
                      alt=""
                      className="h-52 w-full object-cover object-center sm:h-60 lg:h-full lg:max-h-72"
                    />
                  </div>
                </section>

                <section
                  aria-label="Your booking summary"
                  className="grid grid-cols-1 gap-3 md:grid-cols-3"
                >
                  <SummaryCard
                    value={confirmedAheadCount}
                    label="Upcoming Reservations"
                    detail="Your confirmed bookings"
                    tone="blue"
                    icon={<CalendarGlyph />}
                    onClick={() => showReservations("upcoming")}
                  />
                  <SummaryCard
                    value={pendingCount}
                    label="Pending Requests"
                    detail="Requests awaiting approval"
                    tone="sand"
                    icon={<ClockGlyph />}
                    onClick={() => showReservations("pending")}
                  />
                  <SummaryCard
                    value={pastCount}
                    label="Completed Reservations"
                    detail="Successfully used"
                    tone="green"
                    icon={<CheckGlyph />}
                    onClick={() => showReservations("past")}
                  />
                </section>

                <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.75fr)]">
                  <Panel
                    title="Upcoming Reservations"
                    detail="Your confirmed reservations that are still ahead."
                    icon={<CalendarGlyph />}
                    action="View all"
                    onAction={() => showReservations("upcoming")}
                  >
                    {upcomingList.length === 0 ? (
                      <EmptyState
                        title="No upcoming reservations"
                        detail="Book a resource and it will show up here."
                        actionLabel="Browse resources"
                        onAction={() => openSection("book")}
                      />
                    ) : (
                      <ul className="space-y-3">
                        {upcomingList.map((reservation) => (
                          <li key={reservation.id}>
                            <button
                              type="button"
                              onClick={() => showReservations("upcoming")}
                              className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-2.5 text-left transition hover:border-blue-100 hover:bg-slate-50"
                            >
                              <ResourcePhoto
                                resource={{
                                  type: reservation.resourceType,
                                  name: reservation.resourceName,
                                  location: reservation.resourceLocation,
                                }}
                                className="h-16 w-24 rounded-xl"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-slate-900">
                                  {reservation.resourceName}
                                </p>
                                <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                  <PinIcon />
                                  <span className="truncate">
                                    {reservation.resourceLocation}
                                  </span>
                                </p>
                                <p className="mt-1 text-xs text-slate-400">
                                  {formatDashboardWhen(
                                    reservation.startTime,
                                    reservation.endTime
                                  )}
                                </p>
                              </div>
                              <StatusPill reservation={reservation} />
                              <ChevronIcon direction="right" />
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>

                  <Panel
                    title="Quick Actions"
                    detail="Common actions to get started."
                    icon={<BoltGlyph />}
                  >
                    <ul className="space-y-3">
                      <QuickAction
                        icon={<SearchMark />}
                        title="Browse Resources"
                        detail="View available rooms, equipment and more"
                        onClick={() => openSection("book")}
                      />
                      <QuickAction
                        icon={<CalendarGlyph className="h-4 w-4" />}
                        title="My Reservations"
                        detail="View and manage your bookings"
                        onClick={() => showReservations("all")}
                      />
                      <QuickAction
                        icon={<ClockGlyph className="h-4 w-4" />}
                        title="My Requests"
                        detail="Check the status of your requests"
                        onClick={() => showReservations("pending")}
                      />
                    </ul>
                  </Panel>
                </section>

                <section className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.7fr)_minmax(280px,0.8fr)]">
                  <Panel
                    title="Available Resources"
                    detail="Some popular resources for you."
                    icon={<LayersGlyph />}
                    action="View all"
                    onAction={() => openSection("book")}
                  >
                    {previewResources.length === 0 ? (
                      <EmptyState
                        title="Nothing is available yet"
                        detail="An administrator needs to add a resource before you can book."
                      />
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {previewResources.map((resource) => (
                          <article
                            key={resource.id}
                            className="overflow-hidden rounded-2xl border border-slate-100 bg-white"
                          >
                            <ResourcePhoto
                              resource={resource}
                              className="h-32 w-full"
                            />
                            <div className="p-3">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {resource.name}
                              </p>
                              <p className="mt-2 flex items-center gap-1.5 text-xs text-slate-500">
                                <PeopleIcon className="h-3.5 w-3.5 shrink-0" />
                                Capacity: {resource.capacity}{" "}
                                {resource.capacity === 1 ? "person" : "people"}
                              </p>
                              <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                                <PinIcon />
                                <span className="truncate">{resource.location}</span>
                              </p>
                              <div className="mt-3 flex items-center gap-2">
                                <AvailabilityPill
                                  label={availabilityLabel(
                                    resource,
                                    data.occupiedSlots
                                  )}
                                />
                                <button
                                  type="button"
                                  onClick={() => openResourceDetail(resource.id)}
                                  className="ml-auto rounded-lg border border-[#bfdbfe] px-3 py-1.5 text-xs font-semibold text-[#2563eb] transition hover:bg-blue-50"
                                >
                                  View Details
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </Panel>

                  <Panel
                    title="Favourite Resources"
                    detail="Resources you saved with the heart icon."
                    icon={<StarGlyph />}
                    action="View all"
                    onAction={() => openSection("favourites")}
                  >
                    {favouriteResources.length === 0 ? (
                      <EmptyState
                        title="No favourite resources"
                        detail="Save a resource with the heart icon and it will show up here."
                        actionLabel="Browse resources"
                        onAction={() => openSection("book")}
                      />
                    ) : (
                      <ul className="space-y-3">
                        {favouriteResources.map((resource) => (
                          <li key={resource.id} className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => openResourceDetail(resource.id)}
                              className="flex min-w-0 flex-1 items-center gap-3 text-left"
                            >
                              <ResourcePhoto
                                resource={resource}
                                className="h-14 w-[4.5rem] rounded-xl"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm font-semibold text-slate-900">
                                  {resource.name}
                                </span>
                                <span className="mt-0.5 block truncate text-xs text-slate-500">
                                  {resource.location}
                                </span>
                              </span>
                            </button>
                            <AvailabilityPill
                              label={availabilityLabel(
                                resource,
                                data.occupiedSlots
                              )}
                            />
                            <HeartButton
                              active
                              onClick={() => toggleFavourite(resource.id)}
                              label={resource.name}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </section>
              </>
            )}

            {section === "book" && !detailResource && showFavourites && (
              <div className="flex items-center justify-between gap-3 rounded-2xl bg-[#f3eefe] px-4 py-3 text-sm">
                <p className="font-semibold text-slate-800">
                  Showing favourite resources
                </p>
                <button
                  type="button"
                  onClick={() => setShowFavourites(false)}
                  className="font-semibold text-[#7a4fd0]"
                >
                  Show all
                </button>
              </div>
            )}

            {section === "book" && !detailResource && (
              <section>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-[28px]">
                    {showFavourites ? "Favourite Resources" : "Browse Resources"}
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    {showFavourites
                      ? "Resources you saved with the heart icon."
                      : "Select a category to view available resources."}
                  </p>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                  {browseCategories.map((category) => {
                    const active = browseCategory === category;
                    const count =
                      category === "all"
                        ? data.resources.length
                        : data.resources.filter(
                            (resource) => categoryHint(resource) === category
                          ).length;

                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() => setBrowseCategory(category)}
                        className={`flex min-h-[132px] flex-col items-center justify-center rounded-2xl border px-3 py-4 text-center shadow-sm transition ${
                          active
                            ? "border-[#8ec0ff] bg-[#eef6ff] ring-1 ring-[#8ec0ff]"
                            : "border-slate-200 bg-white hover:border-blue-200"
                        }`}
                      >
                        <span className="text-[#3b82f6]">
                          <CategoryIcon id={category} />
                        </span>
                        <span className="mt-3 text-sm font-bold text-slate-800">
                          {category === "all" ? "All" : category}
                        </span>
                        <span className="mt-1 text-xs text-slate-400">
                          {category === "all"
                            ? "View all resources"
                            : count === 1
                              ? "1 resource"
                              : `${count} resources`}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">
                      {showFavourites
                        ? "Favourite Resources"
                        : browseCategory === "all"
                          ? "All Resources"
                          : browseCategory}
                    </h2>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Showing {browseResources.length}{" "}
                      {browseResources.length === 1 ? "resource" : "resources"}
                    </p>
                  </div>
                  <label className="flex items-center gap-2 text-sm text-slate-500">
                    <SortIcon />
                    <span>Sort by</span>
                    <select
                      value={browseSort}
                      onChange={(event) =>
                        setBrowseSort(event.target.value as BrowseSort)
                      }
                      aria-label="Sort resources"
                      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="az">Name (A - Z)</option>
                      <option value="za">Name (Z - A)</option>
                      <option value="capacity">Capacity</option>
                    </select>
                  </label>
                </div>

                {browseResources.length === 0 ? (
                  <EmptyState
                    title={
                      data.resources.length === 0
                        ? "No resources available"
                        : showFavourites
                          ? "No favourite resources"
                          : catalogQuery.trim()
                            ? "No matching resources"
                            : "No resources in this category"
                    }
                    detail={
                      data.resources.length === 0
                        ? "Ask an administrator to add a resource you can book."
                        : showFavourites
                          ? "Save a resource with the heart icon to see it here."
                          : "Try another category, or clear the search."
                    }
                  />
                ) : (
                  <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    {browseResources.map((resource) => (
                      <ResourceCard
                        key={resource.id}
                        resource={resource}
                        favourite={favouriteIds.includes(resource.id)}
                        availability={availabilityLabel(
                          resource,
                          data.occupiedSlots
                        )}
                        onFavourite={() => toggleFavourite(resource.id)}
                        onView={() => openResourceDetail(resource.id)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {showBooking && selectedResource && section === "book" && !detailResource && (
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
                    <FormField label="Date">
                      <input
                        type="date"
                        required
                        min={todayInput}
                        max={latestInput}
                        value={booking.date}
                        onChange={(event) =>
                          updateSlot({ date: event.target.value })
                        }
                        className={inputClass}
                      />
                    </FormField>
                    <div className="grid grid-cols-2 gap-3">
                      <FormField label="Start time">
                        <select
                          required
                          value={booking.startClock}
                          onChange={(event) =>
                            updateSlot({ startClock: event.target.value })
                          }
                          className={inputClass}
                        >
                          {timeChoices.map((choice) => (
                            <option key={`book-start-${choice.value}`} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="End time">
                        <select
                          required
                          value={booking.endClock}
                          onChange={(event) =>
                            updateSlot({ endClock: event.target.value })
                          }
                          className={inputClass}
                        >
                          {timeChoices.map((choice) => (
                            <option key={`book-end-${choice.value}`} value={choice.value}>
                              {choice.label}
                            </option>
                          ))}
                        </select>
                      </FormField>
                    </div>
                    {slot.window && (
                      <p className="text-sm text-slate-500">
                        {formatDuration(
                          slot.window.end.getTime() - slot.window.start.getTime()
                        )}
                        {booking.endClock <= booking.startClock
                          ? " · ends the next day"
                          : ""}
                      </p>
                    )}
                    {slot.error && (
                      <p className="text-sm text-amber-700">{slot.error}</p>
                    )}
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

            {section === "reservations" && !viewingReservation && (
              <div className="space-y-5">
                <div>
                  <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                    My Reservations
                  </h1>
                  <p className="mt-1 text-sm text-slate-500">
                    Manage and track all your resource bookings.
                  </p>
                </div>

                <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <ReservationStat
                    value={confirmedAheadCount}
                    label="Upcoming"
                    detail="Confirmed bookings"
                    tone="blue"
                    icon={<CalendarGlyph />}
                    active={filter === "upcoming"}
                    onClick={() => setFilter("upcoming")}
                  />
                  <ReservationStat
                    value={pendingCount}
                    label="Pending"
                    detail="Awaiting approval"
                    tone="sand"
                    icon={<ClockGlyph />}
                    active={filter === "pending"}
                    onClick={() => setFilter("pending")}
                  />
                  <ReservationStat
                    value={pastCount}
                    label="Completed"
                    detail="Successfully used"
                    tone="green"
                    icon={<CheckGlyph />}
                    active={filter === "past"}
                    onClick={() => setFilter("past")}
                  />
                  <ReservationStat
                    value={cancelledCount}
                    label="Cancelled"
                    detail="Cancelled bookings"
                    tone="rose"
                    icon={<CrossGlyph />}
                    active={filter === "cancelled"}
                    onClick={() => setFilter("cancelled")}
                  />
                </section>

                <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        ["all", "All Reservations"],
                        ["upcoming", "Upcoming"],
                        ["pending", "Pending"],
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
                            ? "bg-[#3b82f6] text-white"
                            : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      type="search"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search your bookings..."
                      aria-label="Search your bookings"
                      className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-blue-300 focus:ring-2 focus:ring-blue-100 sm:w-64"
                    />
                    <select
                      value={dateWindow}
                      onChange={(event) =>
                        setDateWindow(event.target.value as DateWindow)
                      }
                      aria-label="Filter by date"
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 outline-none focus:border-blue-300 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="all">All Dates</option>
                      <option value="today">Today</option>
                      <option value="week">Next 7 days</option>
                      <option value="month">This month</option>
                    </select>
                  </div>
                </div>

                {visibleReservations.length === 0 ? (
                  <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <EmptyState
                      title="No reservations here"
                      detail={
                        filter === "upcoming"
                          ? "You do not have an upcoming booking yet."
                          : filter === "pending"
                            ? "You do not have a booking waiting for approval."
                            : filter === "all"
                              ? "You do not have any reservations yet."
                              : "Nothing matches this view."
                      }
                      actionLabel={
                        filter === "upcoming" || filter === "all"
                          ? "Browse resources"
                          : undefined
                      }
                      onAction={
                        filter === "upcoming" || filter === "all"
                          ? () => openSection("book")
                          : undefined
                      }
                    />
                  </section>
                ) : (
                  <ul className="space-y-4">
                    {visibleReservations.map((reservation) => (
                      <ReservationRow
                        key={reservation.id}
                        reservation={reservation}
                        resource={
                          data.resources.find(
                            (resource) => resource.id === reservation.resourceId
                          ) ?? null
                        }
                        cancelling={cancellingId === reservation.id}
                        onCancel={() => void handleCancel(reservation)}
                        onEdit={() => openPendingEdit(reservation)}
                        onView={() => openReservationView(reservation)}
                      />
                    ))}
                  </ul>
                )}

                <div className="flex items-start gap-3 rounded-2xl border border-[#d7e8ff] bg-[#f3f8ff] px-4 py-3 text-sm text-slate-600">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#dbeafe] text-[#2563eb]">
                    <InfoGlyph />
                  </span>
                  <p>
                    <span className="font-semibold text-slate-800">
                      Cancellation Policy.{" "}
                    </span>
                    You can edit a request that is still waiting for approval,
                    including its time. You can also cancel an upcoming booking
                    or a pending request. Once the reservation has ended, it
                    can no longer be changed.
                  </p>
                </div>
              </div>
            )}

            {section === "notifications" && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Confirmations, completions, and cancellations on your account.
                </p>
                {activity.length === 0 ? (
                  <EmptyState
                    title="You are all caught up"
                    detail="New reservation activity will appear here."
                  />
                ) : (
                  <ul className="mt-5 space-y-4">
                    {activity.map((item) => (
                      <ActivityRow key={item.id} item={item} />
                    ))}
                  </ul>
                )}
              </section>
            )}

            {section === "profile" && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-bold text-slate-900">Profile</h2>
                <div className="mt-5 flex flex-wrap items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-sky-200 to-blue-400 text-xl font-bold text-blue-950">
                    {initials(data.user.name)}
                  </span>
                  <div>
                    <p className="text-lg font-bold text-slate-900">
                      {data.user.name}
                    </p>
                    <p className="text-sm text-slate-500">{data.user.email}</p>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-[#2f6fed]">
                      {data.user.role === "ADMIN" ? "Admin" : "User"}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="/change-password"
                    className="rounded-xl bg-[#3b82f6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2f74ea]"
                  >
                    Change password
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={loggingOut}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                  >
                    {loggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              </section>
            )}

            {detailResource && (
              <ResourceDetailView
                key={detailResource.id}
                resource={detailResource}
                favourite={favouriteIds.includes(detailResource.id)}
                availability={availabilityLabel(detailResource, data.occupiedSlots)}
                date={booking.date}
                startClock={booking.startClock}
                endClock={booking.endClock}
                title={booking.title}
                purpose={booking.purpose}
                slot={slot}
                occupiedSlots={data.occupiedSlots}
                participants={participants}
                notifyParticipants={notifyParticipants}
                saving={saving}
                photoIndex={photoIndex}
                todayInput={todayInput}
                latestInput={latestInput}
                onPhoto={setPhotoIndex}
                onClose={closeResourceDetail}
                onFavourite={() => toggleFavourite(detailResource.id)}
                onDate={(date) => selectDetailClock({ date })}
                onStart={(startClock) => selectDetailClock({ startClock })}
                onEnd={(endClock) => selectDetailClock({ endClock })}
                onTitle={(title) => setBooking((current) => ({ ...current, title }))}
                onPurpose={(purpose) =>
                  setBooking((current) => ({ ...current, purpose }))
                }
                onParticipants={setParticipants}
                onNotify={setNotifyParticipants}
                onBook={handleBook}
                onEdit={
                  viewingReservation
                    ? () => openPendingEdit(viewingReservation)
                    : undefined
                }
                reservation={viewingReservation}
              />
            )}
          </div>
        </div>
      </div>
      {editingReservation && editingResource && (
        <PendingEditDialog
          key={editingReservation.id}
          reservation={editingReservation}
          resource={editingResource}
          occupiedSlots={slotsExceptReservation(
            data.occupiedSlots,
            editingReservation
          )}
          bookerEmail={data.user.email}
          saving={savingEdit}
          todayInput={todayInput}
          latestInput={latestInput}
          onClose={() => setEditingId("")}
          onSubmit={handleEditPending}
        />
      )}
    </div>
  );
}

const bookingHours = Array.from({ length: 12 }, (_, index) => index + 8);

function ResourceDetailView({
  resource,
  favourite,
  availability,
  date,
  startClock,
  endClock,
  title,
  purpose,
  slot,
  occupiedSlots,
  participants,
  notifyParticipants,
  saving,
  photoIndex,
  todayInput,
  latestInput,
  onPhoto,
  onClose,
  onFavourite,
  onDate,
  onStart,
  onEnd,
  onTitle,
  onPurpose,
  onParticipants,
  onNotify,
  onBook,
  onEdit,
  reservation,
}: {
  resource: Resource;
  favourite: boolean;
  availability: Availability;
  date: string;
  startClock: string;
  endClock: string;
  title: string;
  purpose: string;
  slot: { window: { start: Date; end: Date } | null; error: string };
  occupiedSlots: UserDashboardData["occupiedSlots"];
  participants: ParticipantDraft[];
  notifyParticipants: boolean;
  saving: boolean;
  photoIndex: number;
  todayInput: string;
  latestInput: string;
  onPhoto: (index: number) => void;
  onClose: () => void;
  onFavourite: () => void;
  onDate: (date: string) => void;
  onStart: (startClock: string) => void;
  onEnd: (endClock: string) => void;
  onTitle: (title: string) => void;
  onPurpose: (purpose: string) => void;
  onParticipants: (next: ParticipantDraft[]) => void;
  onNotify: (next: boolean) => void;
  onBook: (event: FormEvent<HTMLFormElement>) => void;
  onEdit?: () => void;
  reservation: Reservation | null;
}) {
  const photos = resourceGallery(resource);
  const imageIndex = photos.length === 0 ? 0 : photoIndex % photos.length;
  const blurb = resourceBlurb(resource);
  const facilities = resourceFacilities(resource);
  const minimum = minimumPartySize(resource.capacity);
  const filledOthers = participants.filter(
    (person) => person.name.trim() && person.email.trim()
  ).length;
  const partyReady =
    resource.capacity <= 1 || filledOthers + 1 >= minimum;
  const startOptions = openStartChoices(date, resource.id, occupiedSlots);
  const endOptions = startClock
    ? openEndChoices(date, startClock, resource.id, occupiedSlots)
    : [];
  const timeTaken = Boolean(
    slot.window && !isResourceFree(resource.id, slot.window, occupiedSlots)
  );
  const needsApproval = Boolean(
    slot.window &&
      !timeTaken &&
      needsAdminApproval(
        slot.window.start,
        slot.window.end,
        Intl.DateTimeFormat().resolvedOptions().timeZone
      )
  );
  const timeMessage = timeTaken
    ? "That resource is already booked for the selected time."
    : startClock && endClock && slot.error
      ? slot.error
      : bookingWindowNote(date, startClock, endOptions);
  const selectedDay = date ? combineLocal(date, "12:00") : new Date();
  const [month, setMonth] = useState(() => monthStart(selectedDay));
  const earliest = startOfDay(combineLocal(todayInput, "12:00"));
  const latest = startOfDay(combineLocal(latestInput, "12:00"));
  const days = detailMonthDays(month);

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">
            <button
              type="button"
              onClick={onClose}
              className="font-medium text-slate-500 hover:text-[#2f6fed]"
            >
              {reservation ? "My Reservations" : "Browse Resources"}
            </button>
            <span className="mx-1.5">›</span>
            <span className="text-slate-600">{resource.name}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {resource.name}
            </h1>
            <AvailabilityPill label={availability} verbose />
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{blurb}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onFavourite}
            aria-pressed={favourite}
            aria-label={
              favourite
                ? `Remove ${resource.name} from favourites`
                : `Save ${resource.name} as a favourite`
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-rose-500"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`h-4 w-4 ${favourite ? "fill-rose-500 text-rose-500" : "fill-none"}`}
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#8ec0ff] bg-white px-4 py-2.5 text-sm font-semibold text-[#2f6fed] shadow-sm hover:bg-blue-50"
          >
            {reservation ? "‹ Back to Reservations" : "‹ Back to Resources"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative">
              <GalleryFrame
                src={photos[imageIndex]}
                resource={resource}
                className="h-56 w-full sm:h-72"
              />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() =>
                      onPhoto((imageIndex - 1 + photos.length) % photos.length)
                    }
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => onPhoto((imageIndex + 1) % photos.length)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 p-3">
                {photos.map((photo, index) => (
                  <button
                    key={photo}
                    type="button"
                    onClick={() => onPhoto(index)}
                    aria-label={`Show photo ${index + 1}`}
                    className={`h-14 w-20 overflow-hidden rounded-lg border ${
                      index === imageIndex
                        ? "border-[#3b82f6] ring-2 ring-blue-100"
                        : "border-slate-200"
                    }`}
                  >
                    <GalleryFrame
                      src={photo}
                      resource={resource}
                      className="h-14 w-20"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Details</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <DetailRow icon={<PeopleIcon className="h-4 w-4" />} label="Category">
                {categoryHint(resource)}
              </DetailRow>
              <DetailRow icon={<PeopleIcon className="h-4 w-4" />} label="Capacity">
                {resource.capacity} {resource.capacity === 1 ? "person" : "people"}
              </DetailRow>
              <DetailRow icon={<PinIcon />} label="Location">
                {resource.location}
              </DetailRow>
              <DetailRow icon={<BoxIcon />} label="Facilities">
                {facilities || "Not listed"}
              </DetailRow>
              <DetailRow icon={<NoteIcon />} label="Description">
                {blurb}
              </DetailRow>
            </dl>
          </div>
        </div>

        {reservation ? (
          <ReservationReadonly reservation={reservation} onEdit={onEdit} />
        ) : (
        <form
          onSubmit={onBook}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-3 text-sm font-semibold text-[#2f6fed]">
            <CalendarGlyph className="h-4 w-4" />
            Book a Reservation
          </div>

          <div className="space-y-6 pt-5">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <StepMark n={1} />
                  Select Date
                </h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_148px]">
                  <div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        aria-label="Previous month"
                        disabled={month.getTime() <= monthStart(earliest).getTime()}
                        onClick={() => setMonth(addMonths(month, -1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <p className="text-sm font-semibold text-slate-800">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          year: "numeric",
                        }).format(month)}
                      </p>
                      <button
                        type="button"
                        aria-label="Next month"
                        disabled={month.getTime() >= monthStart(latest).getTime()}
                        onClick={() => setMonth(addMonths(month, 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold text-slate-400">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-y-1 text-center">
                      {days.map((day) => {
                        const key = toDateInput(day);
                        const inMonth = day.getMonth() === month.getMonth();
                        const tooEarly = startOfDay(day).getTime() < earliest.getTime();
                        const tooLate = startOfDay(day).getTime() > latest.getTime();
                        const selected = key === date;
                        const load = dayLoad(resource.id, day, occupiedSlots);
                        const disabled = !inMonth || tooEarly || tooLate || load === "closed";

                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={disabled}
                            onClick={() => onDate(key)}
                            className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                              selected
                                ? "bg-[#3b82f6] font-bold text-white"
                                : disabled
                                  ? "cursor-not-allowed text-slate-300"
                                  : inMonth
                                    ? "text-slate-700 hover:bg-blue-50"
                                    : "text-slate-300"
                            }`}
                          >
                            {day.getDate()}
                            {inMonth && !selected && load !== "closed" && (
                              <span
                                className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                                  load === "full"
                                    ? "bg-rose-500"
                                    : load === "partial"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <ul className="space-y-2 text-xs text-slate-500">
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Available
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Partially booked
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Fully booked
                      </li>
                    </ul>
                    <div className="rounded-xl border border-slate-200 px-3 py-3">
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <CalendarGlyph className="h-4 w-4" />
                        Selected Date
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-900">
                        {date
                          ? new Intl.DateTimeFormat("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(combineLocal(date, "12:00"))
                          : "Choose a date"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <StepMark n={2} />
                  Select Time
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  A booking lasts at least 15 minutes and at most 12 hours, and
                  it must finish before the next reservation.
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <FormField label="Start time">
                    <select
                      required
                      value={startClock}
                      onChange={(event) => onStart(event.target.value)}
                      aria-label="Start time"
                      className={inputClass}
                    >
                      <option value="">Select time</option>
                      {startOptions.map((choice) => (
                        <option key={`detail-start-${choice.value}`} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="End time">
                    <select
                      required
                      value={endClock}
                      onChange={(event) => onEnd(event.target.value)}
                      aria-label="End time"
                      disabled={!startClock}
                      className={inputClass}
                    >
                      <option value="">
                        {startClock ? "Select time" : "Choose a start time first"}
                      </option>
                      {endOptions.map((choice) => (
                        <option key={`detail-end-${choice.value}`} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                {date && startOptions.length === 0 && (
                  <p className="mt-3 text-sm text-amber-700">
                    No start time on this date has a free 15-minute gap.
                  </p>
                )}
                {slot.window && !timeTaken && (
                  <p className="mt-3 text-sm text-slate-500">
                    {formatDuration(slot.window.end.getTime() - slot.window.start.getTime())}
                    {endClock <= startClock ? " · ends the next day" : ""}
                  </p>
                )}
                {timeMessage && (
                  <p className={`mt-3 text-sm ${timeTaken || (startClock && endClock && slot.error) ? "text-amber-700" : "text-slate-500"}`}>
                    {timeMessage}
                  </p>
                )}
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <StepMark n={3} />
                  Confirm Reservation
                </h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <ConfirmStat
                    label="Date"
                    value={
                      date
                        ? new Intl.DateTimeFormat("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(combineLocal(date, "12:00"))
                        : "—"
                    }
                  />
                  <ConfirmStat
                    label="Time"
                    value={
                      startClock && endClock
                        ? `${formatClockLabel(startClock)} – ${formatClockLabel(endClock)}${
                            endClock <= startClock ? " (next day)" : ""
                          }`
                        : "Select a time"
                    }
                  />
                  <ConfirmStat
                    label="Duration"
                    value={
                      slot.window
                        ? formatHourDuration(
                            slot.window.end.getTime() - slot.window.start.getTime()
                          )
                        : "—"
                    }
                  />
                </div>
                <div className="mt-4 space-y-3">
                  <FormField label="Reservation title">
                    <input
                      required
                      maxLength={120}
                      value={title}
                      onChange={(event) => onTitle(event.target.value)}
                      className={inputClass}
                    />
                  </FormField>
                  <FormField label="Purpose (optional)">
                    <input
                      maxLength={500}
                      value={purpose}
                      onChange={(event) => onPurpose(event.target.value)}
                      placeholder="What is this booking for?"
                      className={inputClass}
                    />
                  </FormField>
                  {resource.capacity <= 1 ? (
                    <p className="text-sm text-slate-500">
                      This resource fits one person, so the booking is only for you.
                    </p>
                  ) : (
                    <ParticipantFields
                      capacity={resource.capacity}
                      participants={participants}
                      notify={notifyParticipants}
                      onChange={onParticipants}
                      onNotifyChange={onNotify}
                    />
                  )}
                </div>
                {needsApproval && (
                  <p className="mt-4 text-sm leading-6 text-amber-700">
                    This time is outside office hours (8:00 AM–8:00 PM). It
                    stays pending until an administrator approves it.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={saving || !slot.window || timeTaken || !partyReady}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3b82f6] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2f74ea] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CalendarGlyph className="h-4 w-4" />
                  {saving
                    ? "Booking..."
                    : needsApproval
                      ? "Request approval"
                      : "Book Now"}
                </button>
              </div>
          </div>
        </form>
        )}
      </div>
    </section>
  );
}

function ReservationReadonly({
  reservation,
  onEdit,
}: {
  reservation: Reservation;
  onEdit?: () => void;
}) {
  const schedule = reservationSchedule(reservation.startTime, reservation.endTime);
  const canEdit =
    reservation.status === "PENDING" &&
    reservation.timing !== "past" &&
    Boolean(onEdit);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#2f6fed]">
          <CalendarGlyph className="h-4 w-4" />
          Reservation details
        </h2>
        <StatusBadge reservation={reservation} />
      </div>
      <dl className="mt-5 space-y-4 text-sm">
        <DetailRow icon={<CalendarGlyph className="h-4 w-4" />} label="Date">
          {schedule.date}
        </DetailRow>
        <DetailRow icon={<ClockGlyph className="h-4 w-4" />} label="Time">
          {schedule.time}
        </DetailRow>
        <DetailRow icon={<ClockGlyph className="h-4 w-4" />} label="Duration">
          {schedule.duration}
        </DetailRow>
        <DetailRow icon={<NoteIcon />} label="Title">
          {reservation.title}
        </DetailRow>
        {reservation.purpose && (
          <DetailRow icon={<NoteIcon />} label="Purpose">
            {reservation.purpose}
          </DetailRow>
        )}
        {reservation.participants.length > 0 && (
          <DetailRow icon={<PeopleIcon className="h-4 w-4" />} label="With">
            {reservation.participants.map((person) => person.name).join(", ")}
          </DetailRow>
        )}
      </dl>
      {canEdit ? (
        <div className="mt-5 space-y-3">
          <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
            This request is waiting for approval. You can change the title,
            purpose, people, and the time.
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center rounded-xl border border-[#bfdbfe] px-4 py-2.5 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50"
          >
            Edit request
          </button>
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-500">
          This booking is view only. The date, time, and people cannot be
          changed from here.
        </p>
      )}
    </section>
  );
}

function StepMark({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e8f2ff] text-[11px] font-bold text-[#2f6fed]">
      {n}
    </span>
  );
}

function ConfirmStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-3">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-3">
      <dt className="flex items-center gap-2 font-medium text-slate-500">
        <span className="text-[#3b82f6]">{icon}</span>
        {label}
      </dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}

function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.5V9h5.5M8 13h8M8 17h6" />
    </svg>
  );
}

function GalleryFrame({
  src,
  resource,
  className,
}: {
  src: string;
  resource: { type: string; name: string; location: string };
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return <ResourceVisual resource={resource} className={className} />;
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? "h-40 w-full"}`}
    />
  );
}

function hourState(
  resourceId: string,
  date: string,
  hour: number,
  startClock: string,
  slots: UserDashboardData["occupiedSlots"]
) {
  if (!date) {
    return "past" as const;
  }

  const startClockValue = `${String(hour).padStart(2, "0")}:00`;
  const start = combineLocal(date, startClockValue);
  const end = combineLocal(date, `${String(hour + 1).padStart(2, "0")}:00`);
  const now = Date.now();

  if (start.getTime() < now - 60 * 1000 || start.getTime() > now + MAX_LEAD_MS) {
    return "past" as const;
  }

  if (!isResourceFree(resourceId, { start, end }, slots)) {
    return "booked" as const;
  }

  if (startClock === startClockValue) {
    return "selected" as const;
  }

  return "open" as const;
}

function dayLoad(
  resourceId: string,
  day: Date,
  slots: UserDashboardData["occupiedSlots"]
): "available" | "partial" | "full" | "closed" {
  const date = toDateInput(day);
  let bookable = 0;
  let taken = 0;

  for (const hour of bookingHours) {
    if (hourState(resourceId, date, hour, "", slots) === "past") {
      continue;
    }

    bookable += 1;

    if (hourState(resourceId, date, hour, "", slots) === "booked") {
      taken += 1;
    }
  }

  if (bookable === 0) {
    return "closed";
  }

  if (taken === 0) {
    return "available";
  }

  if (taken === bookable) {
    return "full";
  }

  return "partial";
}

function detailMonthDays(month: Date) {
  const first = monthStart(month);
  const start = addDays(first, -first.getDay());
  const days: Date[] = [];
  let cursor = start;

  while (days.length < 42) {
    days.push(cursor);
    cursor = addDays(cursor, 1);

    if (
      days.length >= 35 &&
      days.length % 7 === 0 &&
      cursor.getMonth() !== month.getMonth()
    ) {
      break;
    }
  }

  return days;
}

function formatHourDuration(ms: number) {
  const minutes = Math.round(ms / 60000);

  if (minutes === 60) {
    return "1 hour";
  }

  return formatDuration(ms);
}

function resourceGallery(resource: { type: string; name: string; location: string }) {
  const primary = resourcePhoto(resource);
  const pool = resourcePhotos[visualKind(resource).id];
  return [primary, ...pool.filter((photo) => photo !== primary)].slice(0, 4);
}

function resourceBlurb(resource: Resource) {
  const description = resource.description?.trim();

  if (description) {
    return description;
  }

  const people =
    resource.capacity === 1 ? "1 person" : `${resource.capacity} people`;

  return `A ${categoryHint(resource).toLowerCase()} for up to ${people} at ${resource.location}.`;
}

function resourceFacilities(resource: Resource) {
  const description = resource.description?.trim() ?? "";

  if (description.includes(",") && description.length <= 160) {
    return description;
  }

  return "";
}

function Panel({
  title,
  detail,
  icon,
  action,
  onAction,
  children,
}: {
  title: string;
  detail?: string;
  icon: ReactNode;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <span className="text-[#2f6fed]">{icon}</span>
            {title}
          </h2>
          {detail && (
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          )}
        </div>
        {action && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-sm font-semibold text-[#3b82f6] hover:text-[#2563eb]"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function QuickAction({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl bg-[#f4f8ff] px-3 py-3 text-left transition hover:bg-[#eaf2ff]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#3b82f6] shadow-sm">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            {title}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>
        </span>
        <ChevronIcon direction="right" />
      </button>
    </li>
  );
}

function SearchMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function BoltGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M13 3 5 14h6l-1 7 8-11h-6z" />
    </svg>
  );
}

function SummaryCard({
  value,
  label,
  detail,
  tone,
  icon,
  onClick,
}: {
  value: number;
  label: string;
  detail: string;
  tone: "blue" | "sand" | "green";
  icon: ReactNode;
  onClick?: () => void;
}) {
  const iconTones = {
    blue: "bg-[#e8f1ff] text-[#3b6fd8]",
    sand: "bg-[#fff4e5] text-[#e39b2b]",
    green: "bg-[#e7f8ee] text-[#1f9a57]",
  };

  const className =
    "flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm";
  const body = (
    <>
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconTones[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-700">
          {label}
        </span>
        <span className="mt-1 block text-2xl font-bold leading-none text-slate-900">
          {value}
        </span>
        <span className="mt-1 block text-xs text-slate-400">{detail}</span>
      </span>
      {onClick && <ChevronIcon direction="right" />}
    </>
  );

  if (!onClick) {
    return <div className={className}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} transition hover:brightness-[0.98]`}
    >
      {body}
    </button>
  );
}

function StatusPill({ reservation }: { reservation: Reservation }) {
  if (reservation.status === "CANCELLED") {
    return <AvailabilityPill label="Cancelled" />;
  }

  if (reservation.timing === "in_progress") {
    return (
      <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
        Now
      </span>
    );
  }

  if (reservation.timing === "past") {
    return (
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Completed
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-[#e7f8ee] px-2.5 py-1 text-xs font-semibold text-[#1f9d55]">
      Upcoming
    </span>
  );
}

function AvailabilityPill({
  label,
  verbose = false,
}: {
  label: Availability | "Cancelled";
  verbose?: boolean;
}) {
  const styles =
    label === "Available"
      ? "bg-[#e7f8ee] text-[#1f9d55]"
      : label === "Limited"
        ? "bg-[#fff4d6] text-[#d97706]"
        : "bg-[#fde8e8] text-[#e11d48]";
  const text = verbose
    ? label === "Limited"
      ? "Limited Availability"
      : label === "Unavailable"
        ? "Not Available"
        : label
    : label === "Unavailable"
      ? "Unavailable"
      : label;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

function HeartButton({
  active,
  onClick,
  label,
  floating = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={
        active ? `Remove ${label} from favourites` : `Save ${label} as a favourite`
      }
      className={`flex h-8 w-8 items-center justify-center rounded-full ${
        floating ? "bg-white/90 shadow-sm" : "hover:bg-rose-50"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`h-4 w-4 ${active ? "fill-rose-500 text-rose-500" : "fill-none text-slate-400"}`}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
      </svg>
    </button>
  );
}

function ActivityRow({
  item,
}: {
  item: {
    id: string;
    kind: "confirmed" | "completed" | "cancelled";
    title: string;
    detail: string;
    at: string;
  };
}) {
  const tone =
    item.kind === "cancelled"
      ? "bg-rose-50 text-rose-500"
      : item.kind === "completed"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-sky-50 text-sky-600";
  const [when, setWhen] = useState("");

  useEffect(() => {
    const update = () => setWhen(relativeTime(item.at));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [item.at]);

  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}
      >
        {item.kind === "cancelled" ? (
          <span className="text-sm font-bold">×</span>
        ) : item.kind === "completed" ? (
          <CheckGlyph />
        ) : (
          <CalendarGlyph />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
        <p className="truncate text-xs text-slate-500">{item.detail}</p>
      </div>
      <span suppressHydrationWarning className="shrink-0 text-xs text-slate-400">
        {when}
      </span>
    </li>
  );
}

function ResourcePhoto({
  resource,
  className,
}: {
  resource: { type: string; name: string; location: string };
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ResourceVisual resource={resource} className={className} />;
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-slate-100 ${className ?? "h-14 w-16"}`}
    >
      <img
        src={resourcePhoto(resource)}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

function ResourceVisual({
  resource,
  className,
}: {
  resource: { type: string; name: string; location: string };
  className?: string;
}) {
  const kind = visualKind(resource);

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-gradient-to-br ${kind.gradient} ${className ?? "h-14 w-16"}`}
    >
      <ResourceScene kind={kind.id} />
    </div>
  );
}

function ResourceScene({ kind }: { kind: VisualKind }) {
  if (kind === "projector") {
    return (
      <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
        <rect x="8" y="18" width="46" height="22" rx="4" fill="#f8fafc" />
        <circle cx="28" cy="29" r="7" fill="#94a3b8" />
        <circle cx="28" cy="29" r="3" fill="#e2e8f0" />
        <rect x="50" y="24" width="10" height="8" rx="1" fill="#cbd5e1" />
      </svg>
    );
  }

  if (kind === "laptop") {
    return (
      <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
        <rect x="18" y="12" width="40" height="26" rx="2" fill="#0f172a" />
        <rect x="21" y="15" width="34" height="20" fill="#38bdf8" />
        <path d="M12 40h56l-6 6H18z" fill="#cbd5e1" />
      </svg>
    );
  }

  if (kind === "lab") {
    return (
      <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
        <rect x="6" y="28" width="16" height="16" rx="1" fill="#1e293b" />
        <rect x="26" y="22" width="16" height="22" rx="1" fill="#0f172a" />
        <rect x="46" y="26" width="16" height="18" rx="1" fill="#1e293b" />
        <rect x="8" y="30" width="12" height="8" fill="#38bdf8" />
        <rect x="28" y="24" width="12" height="10" fill="#22d3ee" />
        <rect x="48" y="28" width="12" height="8" fill="#60a5fa" />
      </svg>
    );
  }

  if (kind === "hall") {
    return (
      <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
        <rect x="8" y="16" width="64" height="28" rx="2" fill="#fff7ed" />
        {Array.from({ length: 4 }, (_, row) =>
          Array.from({ length: 6 }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              x={14 + col * 9}
              y={20 + row * 6}
              width="6"
              height="3"
              rx="0.5"
              fill="#fb923c"
            />
          ))
        )}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
      <rect x="6" y="10" width="68" height="36" rx="3" fill="#dbeafe" />
      <rect x="10" y="14" width="40" height="22" rx="1" fill="#93c5fd" />
      <rect x="54" y="18" width="14" height="18" rx="1" fill="#bfdbfe" />
      <rect x="14" y="38" width="10" height="6" rx="1" fill="#64748b" />
      <rect x="28" y="38" width="10" height="6" rx="1" fill="#64748b" />
    </svg>
  );
}

function NavIcon({
  id,
  active = false,
}: {
  id: Section | "admin" | "favourites";
  active?: boolean;
}) {
  const className = `h-[18px] w-[18px] ${active ? "text-[#2f6fed]" : "text-slate-400"}`;

  if (id === "favourites") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
      </svg>
    );
  }

  if (id === "book") {
    return <LayersGlyph className={className} />;
  }

  if (id === "reservations") {
    return <CalendarGlyph className={className} />;
  }

  if (id === "notifications") {
    return <BellIcon className={className} />;
  }

  if (id === "profile" || id === "admin") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19.5c1.4-3 3.6-4.5 6.5-4.5s5.1 1.5 6.5 4.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

function CategoryIcon({ id }: { id: string }) {
  const className = "h-8 w-8";

  if (id === "Meeting Room") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M6 21V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V21" />
        <path d="M6 21h12" />
        <circle cx="15.2" cy="12" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (id === "Computer Lab") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="1.6" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    );
  }

  if (id === "Equipment") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <rect x="2.5" y="8" width="13" height="8" rx="1.6" />
        <circle cx="8.5" cy="12" r="2" />
        <path d="M15.5 10.2h3.2L20.5 12l-1.8 1.8h-3.2" />
      </svg>
    );
  }

  return <PeopleIcon className={className} />;
}

function PeopleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="8" r="2.3" />
      <circle cx="16" cy="9" r="1.8" />
      <path d="M4.2 18.2c.9-2.5 2.7-3.7 4.8-3.7s3.9 1.2 4.8 3.7" />
      <path d="M14 14.8c1.5-.5 3-.2 4.2.9.8.8 1.3 1.7 1.6 2.5" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10z" />
      <circle cx="12" cy="11" r="1.8" />
    </svg>
  );
}

function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m12 3 8 4-8 4-8-4z" />
      <path d="M4 7v8l8 4 8-4V7" />
      <path d="M12 11v8" />
    </svg>
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#3b82f6]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 6v12M8 6 5.5 8.5M8 6l2.5 2.5M16 18V6M16 18l-2.5-2.5M16 18l2.5-2.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function BellIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 16.5h12l-1.2-2V10a4.8 4.8 0 0 0-9.6 0v4.5z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

function CalendarGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

function ClockGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

function CheckGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  );
}

function StarGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m12 4 2.1 4.4 4.9.7-3.5 3.4.8 4.8L12 15.8 7.7 17.3l.8-4.8L5 9.1l4.9-.7z" />
    </svg>
  );
}

function LayersGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m12 4 8 4-8 4-8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </svg>
  );
}

function SharedResourcesArt() {
  return (
    <svg viewBox="0 0 180 120" className="mx-auto h-28 w-40" aria-hidden="true">
      <ellipse cx="90" cy="104" rx="58" ry="8" fill="#e8eef6" />
      <path d="M48 78V52l42-24 42 24v26" fill="#f8fbff" stroke="#93c5fd" strokeWidth="2" />
      <path d="M70 78V58h20v20" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
      <path d="M36 86c8-16 14-16 18 0" fill="#86efac" />
      <path d="M28 90c6-12 12-12 16 0" fill="#4ade80" />
      <rect x="40" y="72" width="3" height="16" rx="1" fill="#65a30d" />
      <path d="M124 84c10-18 18-16 22 2" fill="#86efac" />
      <path d="M136 90c8-14 14-12 16 2" fill="#4ade80" />
      <rect x="132" y="74" width="3" height="16" rx="1" fill="#65a30d" />
      <circle cx="58" cy="46" r="6" fill="#bfdbfe" />
      <rect x="108" y="40" width="10" height="8" rx="1" fill="#93c5fd" />
    </svg>
  );
}

function ResourceCard({
  resource,
  favourite,
  availability,
  onFavourite,
  onView,
}: {
  resource: Resource;
  favourite: boolean;
  availability: Availability;
  onFavourite: () => void;
  onView: () => void;
}) {
  const equipment =
    categoryHint(resource) === "Equipment" ||
    resource.type === "PROJECTOR" ||
    resource.type === "VEHICLE";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative">
        <ResourcePhoto resource={resource} className="h-36 w-full" />
        <div className="absolute right-3 top-3">
          <HeartButton
            active={favourite}
            onClick={onFavourite}
            label={resource.name}
            floating
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-[15px] font-bold text-slate-900">
          {resource.name}
        </h3>
        <div className="mt-2 space-y-1.5 text-sm text-slate-500">
          {equipment ? (
            <p className="flex items-center gap-2">
              <BoxIcon />
              Equipment
            </p>
          ) : (
            <p className="flex items-center gap-2">
              <PeopleIcon className="h-4 w-4 shrink-0" />
              Capacity: {resource.capacity}{" "}
              {resource.capacity === 1 ? "person" : "people"}
            </p>
          )}
          <p className="flex items-center gap-2">
            <PinIcon />
            <span className="truncate">{resource.location}</span>
          </p>
        </div>
        <div className="mt-3">
          <AvailabilityPill label={availability} verbose />
        </div>
        <button
          type="button"
          onClick={onView}
          className="mt-4 w-full rounded-lg border border-[#3b82f6] py-2 text-sm font-semibold text-[#3b82f6] transition hover:bg-blue-50"
        >
          View Details
        </button>
      </div>
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

function ChevronIcon({
  direction,
}: {
  direction: "left" | "right" | "down";
}) {
  const path =
    direction === "left"
      ? "M14.5 6.5 9 12l5.5 5.5"
      : direction === "down"
        ? "M6.5 9.5 12 15l5.5-5.5"
        : "M9.5 6.5 15 12l-5.5 5.5";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d={path} />
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

function ReservationRow({
  reservation,
  resource,
  cancelling,
  onCancel,
  onEdit,
  onView,
}: {
  reservation: Reservation;
  resource: Resource | null;
  cancelling: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onView: () => void;
}) {
  const canCancel =
    (reservation.status === "CONFIRMED" || reservation.status === "PENDING") &&
    reservation.timing !== "past";
  const canEdit = reservation.status === "PENDING" && reservation.timing !== "past";
  const schedule = reservationSchedule(reservation.startTime, reservation.endTime);
  const facilities = resource ? resourceFacilities(resource) : "";
  const category = resource
    ? categoryHint(resource)
    : labelType(reservation.resourceType);

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <ResourcePhoto
          resource={{
            type: reservation.resourceType,
            name: reservation.resourceName,
            location: reservation.resourceLocation,
          }}
          className="h-36 w-full rounded-xl lg:h-32 lg:w-44"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900">
            {reservation.resourceName}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            <li className="flex items-center gap-2">
              <LayersGlyph className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">{category}</span>
            </li>
            <li className="flex items-center gap-2">
              <PinIcon />
              <span className="truncate">{reservation.resourceLocation}</span>
            </li>
            {resource && (
              <li className="flex items-center gap-2">
                <PeopleIcon className="h-4 w-4 shrink-0" />
                Capacity: {resource.capacity}{" "}
                {resource.capacity === 1 ? "person" : "people"}
              </li>
            )}
            <li className="flex items-center gap-2">
              <BoxIcon />
              <span className="truncate">
                Facilities: {facilities || "Not listed"}
              </span>
            </li>
          </ul>
          {reservation.purpose && (
            <p className="mt-2 text-sm text-slate-500">{reservation.purpose}</p>
          )}
        </div>
        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3 lg:w-52 lg:grid-cols-1">
          <p className="flex items-start gap-2">
            <CalendarGlyph className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <span className="block text-xs text-slate-400">Date</span>
              {schedule.date}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ClockGlyph className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <span className="block text-xs text-slate-400">Time</span>
              {schedule.time}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ClockGlyph className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <span className="block text-xs text-slate-400">Duration</span>
              {schedule.duration}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:w-44 lg:items-end">
          <StatusBadge reservation={reservation} />
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {resource && (
              <button
                type="button"
                onClick={onView}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#bfdbfe] px-3 py-2 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50"
              >
                <EyeGlyph />
                View Details
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#bfdbfe] px-3 py-2 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50"
              >
                <PencilGlyph />
                Edit
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                <TrashGlyph />
                {cancelling
                  ? "Cancelling..."
                  : reservation.status === "PENDING"
                    ? "Cancel Request"
                    : "Cancel"}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

function StatusBadge({ reservation }: { reservation: Reservation }) {
  if (reservation.status === "CANCELLED") {
    return <Badge className="bg-rose-50 text-rose-600">Cancelled</Badge>;
  }

  if (reservation.status === "PENDING") {
    return <Badge className="bg-amber-50 text-amber-700">Pending Approval</Badge>;
  }

  if (reservation.timing === "in_progress") {
    return <Badge className="bg-sky-50 text-sky-700">Happening now</Badge>;
  }

  if (reservation.timing === "past") {
    return <Badge className="bg-emerald-50 text-emerald-700">Completed</Badge>;
  }

  return <Badge className="bg-emerald-50 text-emerald-700">Upcoming</Badge>;
}

function ReservationStat({
  value,
  label,
  detail,
  tone,
  icon,
  active,
  onClick,
}: {
  value: number;
  label: string;
  detail: string;
  tone: "blue" | "sand" | "green" | "rose";
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const iconTones = {
    blue: "bg-[#e8f1ff] text-[#3b6fd8]",
    sand: "bg-[#fff4e5] text-[#e39b2b]",
    green: "bg-[#e7f8ee] text-[#1f9a57]",
    rose: "bg-[#fde8e8] text-[#e11d48]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-4 text-left shadow-sm transition hover:border-blue-200 ${
        active ? "border-[#93c5fd] ring-2 ring-blue-100" : "border-slate-200/80"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconTones[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-700">{label}</span>
        <span className="mt-0.5 block text-2xl font-bold leading-none text-slate-900">
          {value}
        </span>
        <span className="mt-1 block text-xs text-slate-400">{detail}</span>
      </span>
      <ChevronIcon direction="right" />
    </button>
  );
}

function PendingEditDialog({
  reservation,
  resource,
  occupiedSlots,
  bookerEmail,
  saving,
  todayInput,
  latestInput,
  onClose,
  onSubmit,
}: {
  reservation: Reservation;
  resource: Resource;
  occupiedSlots: UserDashboardData["occupiedSlots"];
  bookerEmail: string;
  saving: boolean;
  todayInput: string;
  latestInput: string;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    purpose: string;
    startTime: string;
    endTime: string;
    participants: { name: string; email: string }[];
    notifyParticipants: boolean;
  }) => Promise<void>;
}) {
  const start = new Date(reservation.startTime);
  const end = new Date(reservation.endTime);
  const [date, setDate] = useState(toDateInput(start));
  const [startClock, setStartClock] = useState(toClockInput(start));
  const [endClock, setEndClock] = useState(toClockInput(end));
  const [title, setTitle] = useState(reservation.title);
  const [purpose, setPurpose] = useState(reservation.purpose ?? "");
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() =>
    draftsFromReservation(reservation, resource.capacity)
  );
  const [notify, setNotify] = useState(true);
  const [formError, setFormError] = useState("");
  const slot = resolveSlot(date, startClock, endClock);
  const startOptions = ensureClockChoice(
    openStartChoices(date, resource.id, occupiedSlots),
    startClock
  );
  const endOptions = startClock
    ? ensureClockChoice(
        openEndChoices(date, startClock, resource.id, occupiedSlots),
        endClock
      )
    : [];
  const timeTaken = Boolean(
    slot.window && !isResourceFree(resource.id, slot.window, occupiedSlots)
  );
  const needsApproval = Boolean(
    slot.window &&
      !timeTaken &&
      needsAdminApproval(
        slot.window.start,
        slot.window.end,
        Intl.DateTimeFormat().resolvedOptions().timeZone
      )
  );
  const minimum = minimumPartySize(resource.capacity);
  const filledOthers = participants.filter(
    (person) => person.name.trim() && person.email.trim()
  ).length;
  const partyReady = resource.capacity <= 1 || filledOthers + 1 >= minimum;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!slot.window) {
      setFormError(slot.error || "Choose a valid date and time.");
      return;
    }

    if (timeTaken) {
      setFormError("That resource is already booked for the selected time.");
      return;
    }

    let filledPeople: { name: string; email: string }[] = [];

    try {
      if (resource.capacity > 1) {
        filledPeople = parseParticipants(participants);
        assertParticipantCapacity(resource.capacity, filledPeople, bookerEmail);
      }
    } catch (error) {
      if (error instanceof ParticipantInputError) {
        setFormError(error.message);
        return;
      }

      throw error;
    }

    try {
      await onSubmit({
        title: title.trim(),
        purpose: purpose.trim(),
        startTime: slot.window.start.toISOString(),
        endTime: slot.window.end.toISOString(),
        participants: filledPeople.map((person) => ({
          name: person.name.trim().replace(/\s+/g, " "),
          email: person.email.trim().toLowerCase(),
        })),
        notifyParticipants: notify && filledPeople.length > 0,
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to update this request."
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="max-h-[min(90vh,760px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Edit pending request</h2>
            <p className="mt-1 text-sm text-slate-500">
              {resource.name} · {resource.location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close edit form"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <FormField label="Date">
            <input
              type="date"
              required
              min={todayInput}
              max={latestInput}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start time">
              <select
                required
                value={startClock}
                onChange={(event) => {
                  setStartClock(event.target.value);
                  setEndClock("");
                }}
                className={inputClass}
              >
                <option value="">Select time</option>
                {startOptions.map((choice) => (
                  <option key={`edit-start-${choice.value}`} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="End time">
              <select
                required
                value={endClock}
                onChange={(event) => setEndClock(event.target.value)}
                disabled={!startClock}
                className={inputClass}
              >
                <option value="">
                  {startClock ? "Select time" : "Choose a start time first"}
                </option>
                {endOptions.map((choice) => (
                  <option key={`edit-end-${choice.value}`} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <p className="text-sm text-slate-500">
            Leave the time as it is, or choose another slot. A time outside
            8:00 AM–8:00 PM stays pending. A time inside office hours is
            confirmed when you save.
          </p>
          {slot.window && !timeTaken && (
            <p className="text-sm text-slate-500">
              {formatDuration(slot.window.end.getTime() - slot.window.start.getTime())}
              {endClock <= startClock ? " · ends the next day" : ""}
            </p>
          )}
          {(formError || slot.error || timeTaken) && (
            <p className="text-sm text-amber-700">
              {formError ||
                (timeTaken
                  ? "That resource is already booked for the selected time."
                  : slot.error)}
            </p>
          )}
          <FormField label="Title">
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Purpose (optional)">
            <input
              maxLength={500}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
              placeholder="What is this booking for?"
              className={inputClass}
            />
          </FormField>
          {resource.capacity <= 1 ? (
            <p className="text-sm text-slate-500">
              This resource fits one person, so the booking is only for you.
            </p>
          ) : (
            <ParticipantFields
              capacity={resource.capacity}
              participants={participants}
              notify={notify}
              onChange={setParticipants}
              onNotifyChange={setNotify}
            />
          )}
          {needsApproval && (
            <p className="text-sm leading-6 text-amber-700">
              This time is outside office hours, so the request stays pending
              until an administrator approves it. Added people are emailed
              after it is confirmed.
            </p>
          )}
          {slot.window && !needsApproval && !timeTaken && (
            <p className="text-sm leading-6 text-emerald-700">
              This time is inside office hours. Saving confirms the booking.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !slot.window || timeTaken || !partyReady}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function draftsFromReservation(reservation: Reservation, capacity: number) {
  const drafts = reservation.participants.map((person) => ({
    name: person.name,
    email: person.email,
  }));
  const needed = Math.max(minimumPartySize(capacity) - 1, 0);

  while (drafts.length < needed) {
    drafts.push({ name: "", email: "" });
  }

  return drafts;
}

function slotsExceptReservation(
  slots: UserDashboardData["occupiedSlots"],
  reservation: Reservation
) {
  const start = new Date(reservation.startTime).getTime();
  const end = new Date(reservation.endTime).getTime();

  return slots.filter((slot) => {
    if (slot.resourceId !== reservation.resourceId) {
      return true;
    }

    return (
      new Date(slot.startTime).getTime() !== start ||
      new Date(slot.endTime).getTime() !== end
    );
  });
}

function ensureClockChoice(
  options: { value: string; label: string }[],
  value: string
) {
  if (!value || options.some((choice) => choice.value === value)) {
    return options;
  }

  return [{ value, label: formatClockLabel(value) }, ...options];
}

function PencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a1.4 1.4 0 0 0 0-2L16.5 5.5a1.4 1.4 0 0 0-2 0L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

function EyeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" />
    </svg>
  );
}

function CrossGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

function InfoGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
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
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
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

function openStartChoices(
  date: string,
  resourceId: string,
  slots: UserDashboardData["occupiedSlots"]
) {
  if (!date) {
    return [];
  }

  return timeChoices.filter((choice) => {
    const probe = new Date(
      combineLocal(date, choice.value).getTime() + MIN_DURATION_MS
    );
    const resolved = resolveSlot(date, choice.value, toClockInput(probe));

    return (
      resolved.window !== null &&
      isResourceFree(resourceId, resolved.window, slots)
    );
  });
}

function openEndChoices(
  date: string,
  startClock: string,
  resourceId: string,
  slots: UserDashboardData["occupiedSlots"]
) {
  if (!date || !startClock) {
    return [];
  }

  const start = combineLocal(date, startClock);
  const choices: { value: string; label: string }[] = [];

  for (
    let offset = MIN_DURATION_MS;
    offset <= MAX_DURATION_MS;
    offset += MIN_DURATION_MS
  ) {
    const end = new Date(start.getTime() + offset);
    const endClock = toClockInput(end);
    const resolved = resolveSlot(date, startClock, endClock);

    if (!resolved.window || !isResourceFree(resourceId, resolved.window, slots)) {
      if (choices.length > 0) {
        break;
      }

      continue;
    }

    const nextDay = end.toDateString() !== start.toDateString();
    choices.push({
      value: endClock,
      label: `${formatClockLabel(endClock)}${nextDay ? " (next day)" : ""}`,
    });
  }

  return choices;
}

function bookingWindowNote(
  date: string,
  startClock: string,
  endOptions: { value: string; label: string }[]
) {
  if (!date || !startClock) {
    return "";
  }

  if (endOptions.length === 0) {
    return "There is no free 15-minute gap after this start time.";
  }

  const start = combineLocal(date, startClock);
  const last = endOptions[endOptions.length - 1];
  const resolved = resolveSlot(date, startClock, last.value);

  if (
    resolved.window &&
    resolved.window.end.getTime() < start.getTime() + MAX_DURATION_MS
  ) {
    return `You can book until ${last.label}. This resource is already reserved after that.`;
  }

  return "";
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

type VisualKind = "room" | "projector" | "laptop" | "lab" | "hall";

const resourcePhotos: Record<VisualKind, string[]> = {
  room: [
    "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=900&q=70",
    "https://images.unsplash.com/photo-1431540015161-0bf868a2d407?auto=format&fit=crop&w=900&q=70",
    "https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=900&q=70",
  ],
  hall: [
    "https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=900&q=70",
    "https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&w=900&q=70",
  ],
  lab: [
    "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?auto=format&fit=crop&w=900&q=70",
    "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=900&q=70",
  ],
  laptop: [
    "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?auto=format&fit=crop&w=900&q=70",
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=900&q=70",
  ],
  projector: [
    "https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=900&q=70",
  ],
};

function resourcePhoto(resource: { type: string; name: string; location: string }) {
  const blob = `${resource.type} ${resource.name}`.toLowerCase();

  if (blob.includes("whiteboard") || blob.includes("board")) {
    return "https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=900&q=70";
  }

  if (blob.includes("printer")) {
    return "https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?auto=format&fit=crop&w=900&q=70";
  }

  const kind = visualKind(resource).id;
  const photos = resourcePhotos[kind];
  const index =
    [...resource.name].reduce((sum, char) => sum + char.charCodeAt(0), 0) %
    photos.length;

  return photos[index];
}

function visualKind(resource: { type: string; name: string; location: string }) {
  const blob = `${resource.type} ${resource.name} ${resource.location}`.toLowerCase();

  if (blob.includes("projector")) {
    return { id: "projector" as const, gradient: "from-slate-200 to-slate-400" };
  }

  if (blob.includes("laptop") || blob.includes("computer") || resource.type === "DESK") {
    return { id: "laptop" as const, gradient: "from-zinc-200 to-slate-500" };
  }

  if (blob.includes("lab")) {
    return { id: "lab" as const, gradient: "from-indigo-200 to-blue-500" };
  }

  if (
    blob.includes("hall") ||
    blob.includes("conference") ||
    resource.type === "CONFERENCE_ROOM"
  ) {
    return { id: "hall" as const, gradient: "from-amber-100 to-orange-300" };
  }

  return { id: "room" as const, gradient: "from-sky-200 to-blue-400" };
}

function categoryHint(resource: { type: string; name: string; location: string }) {
  const blob = `${resource.type} ${resource.name} ${resource.location}`.toLowerCase();

  if (blob.includes("lab")) {
    return "Computer Lab";
  }

  if (resource.type === "PROJECTOR" || blob.includes("projector")) {
    return "Equipment";
  }

  if (
    resource.type === "CONFERENCE_ROOM" ||
    blob.includes("hall") ||
    blob.includes("conference")
  ) {
    return "Event Space";
  }

  if (resource.type === "MEETING_ROOM") {
    return "Meeting Room";
  }

  if (resource.type === "DESK") {
    return "Workspace";
  }

  if (resource.type === "VEHICLE") {
    return "Vehicle";
  }

  return labelType(resource.type);
}

function matchesResource(
  resource: { name: string; type: string; location: string; description: string | null },
  query: string
) {
  const term = query.trim().toLowerCase();

  if (!term) {
    return true;
  }

  return (
    resource.name.toLowerCase().includes(term) ||
    labelType(resource.type).toLowerCase().includes(term) ||
    categoryHint(resource).toLowerCase().includes(term) ||
    resource.location.toLowerCase().includes(term) ||
    (resource.description ?? "").toLowerCase().includes(term)
  );
}

function availabilityLabel(
  resource: Resource,
  slots: UserDashboardData["occupiedSlots"]
): Availability {
  const now = Date.now();
  const busyNow = slots.some((slot) => {
    if (slot.resourceId !== resource.id) {
      return false;
    }

    return (
      new Date(slot.startTime).getTime() <= now &&
      new Date(slot.endTime).getTime() > now
    );
  });

  if (busyNow) {
    return "Unavailable";
  }

  if (resource.upcomingBookings >= 3) {
    return "Limited";
  }

  return "Available";
}

function buildActivity(reservations: Reservation[]) {
  return reservations
    .map((reservation) => {
      if (reservation.status === "PENDING") {
        return {
          id: `${reservation.id}-pending`,
          kind: "confirmed" as const,
          title: "Waiting for approval",
          detail: reservation.resourceName,
          at: reservation.createdAt,
        };
      }

      if (reservation.status === "CANCELLED") {
        return {
          id: `${reservation.id}-cancelled`,
          kind: "cancelled" as const,
          title: "Reservation cancelled",
          detail: reservation.resourceName,
          at: reservation.updatedAt,
        };
      }

      if (reservation.timing === "past") {
        return {
          id: `${reservation.id}-completed`,
          kind: "completed" as const,
          title: "Reservation completed",
          detail: reservation.resourceName,
          at: reservation.endTime,
        };
      }

      return {
        id: `${reservation.id}-confirmed`,
        kind: "confirmed" as const,
        title:
          reservation.timing === "in_progress"
            ? "Reservation in progress"
            : "Reservation confirmed",
        detail: reservation.resourceName,
        at: reservation.createdAt,
      };
    })
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function reservationListRank(reservation: Reservation) {
  if (reservation.status === "CONFIRMED" && reservation.timing !== "past") {
    return 0;
  }

  if (reservation.status === "PENDING") {
    return 1;
  }

  if (reservation.status === "CONFIRMED") {
    return 2;
  }

  return 3;
}

function inDateWindow(iso: string, window: DateWindow) {
  if (window === "all") {
    return true;
  }

  const start = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (window === "today") {
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);
    return start >= today && start < tomorrow;
  }

  if (window === "week") {
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    return start >= today && start < nextWeek;
  }

  return (
    start.getFullYear() === now.getFullYear() && start.getMonth() === now.getMonth()
  );
}

function reservationSchedule(startIso: string, endIso: string) {
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
  const sameDay = start.toDateString() === end.toDateString();

  return {
    date: date.format(start),
    time: sameDay
      ? `${time.format(start)} – ${time.format(end)}`
      : `${time.format(start)} – ${date.format(end)} ${time.format(end)}`,
    duration: formatBookingLength(end.getTime() - start.getTime()),
  };
}

function formatBookingLength(ms: number) {
  const minutes = Math.max(Math.round(ms / 60000), 0);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const hourLabel = hours === 1 ? "1 hour" : `${hours} hours`;
  const minuteLabel = rest === 1 ? "1 minute" : `${rest} minutes`;

  if (hours === 0) {
    return minuteLabel;
  }

  if (rest === 0) {
    return hourLabel;
  }

  return `${hourLabel} ${minuteLabel}`;
}

function formatDashboardWhen(startIso: string, endIso: string) {
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

  return `${date.format(start)}  |  ${time.format(start)} - ${time.format(end)}`;
}

function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

function formatClockSpan(startIso: string, endIso: string) {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${time.format(new Date(startIso))} - ${time.format(new Date(endIso))}`;
}

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
  }

  const days = Math.round(hours / 24);

  if (days < 14) {
    return days === 1 ? "1 day ago" : `${days} days ago`;
  }

  return formatShortDate(iso);
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
