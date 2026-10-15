"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
import { jobPositionLabel } from "@/lib/job-position";
import { RESOURCE_CATALOG, canBookMeetingRoom, categoryLabel, isMeetingRoom, maxBookingDurationMs, subcategoryLabel } from "@/lib/resource-catalog";
import { ParticipantInputError, assertParticipantCapacity, parseParticipants } from "@/lib/reservation-participants";
import { ActivityRow, AvailabilityPill, EmptyState, FormField, HeartButton, Panel, ParticipantFields, QuickAction, ReservationStat, SummaryCard } from "@/components/member/widgets";
import { BellIcon, BoltGlyph, CalendarGlyph, CategoryIcon, CheckGlyph, ChevronIcon, ClockGlyph, CrossGlyph, InfoGlyph, LayersGlyph, NavIcon, PeopleIcon, PinIcon, ResourcePhoto, ResourceVisual, SearchIcon, SearchMark, SharedResourcesArt, SortIcon, StarGlyph } from "@/components/member/icons";
import { PendingEditDialog, ReservationRow } from "@/components/member/reservations";
import { ResourceCard } from "@/components/member/browse";
import { ResourceDetailView } from "@/components/member/resource-detail";
import { UpcomingSchedule } from "@/components/member/schedule";
import { addDays, availabilityLabel, buildActivity, categoryHint, defaultSlot, emptyBooking, emptyParty, formatBookingDate, formatDuration, inDateWindow, initials, inputClass, isResourceFree, matchesResource, openEndChoices, openStartChoices, resolveSlot, sections, slotsExceptReservation, startOfDay, timeChoices, toDateInput, type BrowseSort, type DateWindow, type ParticipantDraft, type Reservation, type ReservationFilter, type Resource, type Section, type UserDashboardData } from "@/components/member/model";

export type { UserDashboardData } from "@/components/member/model";

export default function DashboardClient({
  data,
}: {
  data: UserDashboardData;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("overview");
  const [filter, setFilter] = useState<ReservationFilter>("upcoming");
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
  const [clearedNoticeAt, setClearedNoticeAt] = useState(0);
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

  const slot = useMemo(() => {
    const resource = data.resources.find(
      (item) => item.id === (booking.resourceId || detailResourceId)
    );

    return resolveSlot(
      booking.date,
      booking.startClock,
      booking.endClock,
      maxBookingDurationMs(resource?.category)
    );
  }, [
    booking.date,
    booking.startClock,
    booking.endClock,
    booking.resourceId,
    detailResourceId,
    data.resources,
  ]);

  const visibleReservations = useMemo(() => {
    const term = search.trim().toLowerCase();

    return data.reservations
      .filter((reservation) => {
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

    const cleared = Number(localStorage.getItem(`${favoriteKey}:cleared`) || 0);
    if (Number.isFinite(cleared)) {
      setClearedNoticeAt(cleared);
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

  function clearNotifications() {
    const clearedAt = Date.now();
    setClearedNoticeAt(clearedAt);
    setSeenNoticeAt(clearedAt);
    localStorage.setItem(`${favoriteKey}:cleared`, String(clearedAt));
    localStorage.setItem(`${favoriteKey}:seen`, String(clearedAt));
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
      category: picked?.category ?? "",
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
        !openStartChoices(
          next.date,
          resourceId,
          data.occupiedSlots,
          maxBookingDurationMs(
            data.resources.find((item) => item.id === resourceId)?.category
          )
        ).some((choice) => choice.value === next.startClock)
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
          data.occupiedSlots,
          maxBookingDurationMs(
            data.resources.find((item) => item.id === resourceId)?.category
          )
        ).some((choice) => choice.value === next.endClock)
      ) {
        next.endClock = "";
      }

      return next;
    });
  }

  function openBooking(resourceId = "") {
    const nextSlot = defaultSlot();
    const picked = data.resources.find((resource) => resource.id === resourceId);
    const resolved = resolveSlot(
      nextSlot.date,
      nextSlot.startClock,
      nextSlot.endClock,
      maxBookingDurationMs(picked?.category)
    );
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
      category: picked?.category ?? "",
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
    const resolved = resolveSlot(
      next.date,
      next.startClock,
      next.endClock,
      maxBookingDurationMs(
        data.resources.find((item) => item.id === next.resourceId)?.category
      )
    );
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

    const bookedResource = data.resources.find(
      (resource) => resource.id === booking.resourceId
    );

    if (
      bookedResource &&
      isMeetingRoom(bookedResource.category) &&
      !canBookMeetingRoom(data.user.role, data.user.jobPosition)
    ) {
      setError(
        "Only a manager, team leader, or scrum master can book a meeting room."
      );
      return;
    }

    const resolved = resolveSlot(
      booking.date,
      booking.startClock,
      booking.endClock,
      maxBookingDurationMs(bookedResource?.category)
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

    if (!bookedResource) {
      setError("Choose a resource to book.");
      return;
    }

    const purpose = booking.purpose.trim();

    if (!purpose) {
      setError("Enter a purpose for this booking.");
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
          purpose,
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

      setSuccess(payload.message || "Reservation cancelled.");
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
  const activity = buildActivity(data.reservations).filter(
    (item) => new Date(item.at).getTime() > clearedNoticeAt
  );
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
  const scheduleReservations = [...inProgress, ...upcoming].filter(
    (reservation) => reservation.status === "CONFIRMED"
  );
  const viewerCanBookMeetingRooms = canBookMeetingRoom(
    data.user.role,
    data.user.jobPosition
  );
  const browseCategories = [
    { id: "all", label: "All" },
    ...RESOURCE_CATALOG.map((category) => ({
      id: category.value,
      label: category.label,
    })),
  ];
  const browseResources = data.resources
    .filter((resource) => {
      if (showFavourites && !favouriteIds.includes(resource.id)) {
        return false;
      }

      if (browseCategory !== "all" && resource.category !== browseCategory) {
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
                      ? showReservations("upcoming")
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
            <button
              type="button"
              onClick={() => void handleLogout()}
              disabled={loggingOut}
              className="mt-3 flex w-full items-center justify-center rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
            >
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
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

              <ThemeToggle />
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
                      ? showReservations("upcoming")
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
                          onClick={() => showReservations("upcoming")}
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
                    detail="Confirmed bookings still ahead. Highlighted days have a schedule."
                    icon={<CalendarGlyph />}
                    action="View all"
                    onAction={() => showReservations("upcoming")}
                  >
                    <UpcomingSchedule
                      reservations={scheduleReservations}
                      resources={data.resources}
                      onOpen={openReservationView}
                      onBrowse={() => openSection("book")}
                    />
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
                        onClick={() => showReservations("upcoming")}
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

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
                  {browseCategories.map((category) => {
                    const active = browseCategory === category.id;
                    const count =
                      category.id === "all"
                        ? data.resources.length
                        : data.resources.filter(
                            (resource) => resource.category === category.id
                          ).length;

                    return (
                      <button
                        key={category.id}
                        type="button"
                        onClick={() => setBrowseCategory(category.id)}
                        className={`flex min-h-[132px] flex-col items-center justify-center rounded-2xl border px-3 py-4 text-center shadow-sm transition ${
                          active
                            ? "border-[#8ec0ff] bg-[#eef6ff] ring-1 ring-[#8ec0ff]"
                            : "border-slate-200 bg-white hover:border-blue-200"
                        }`}
                      >
                        <span className="text-[#3b82f6]">
                          <CategoryIcon id={category.id} />
                        </span>
                        <span className="mt-3 text-sm font-bold leading-5 text-slate-800">
                          {category.label}
                        </span>
                        <span className="mt-1 text-xs text-slate-400">
                          {category.id === "all"
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
                          : categoryLabel(browseCategory)}
                    </h2>
                    {browseCategory === "MEETING_ROOMS" &&
                      !viewerCanBookMeetingRooms && (
                        <p className="mt-1 text-sm text-amber-700">
                          Only a manager, team leader, or scrum master can book
                          a meeting room.
                        </p>
                      )}
                    {browseCategory === "COMPANY_VEHICLES" && (
                      <p className="mt-1 text-sm text-slate-500">
                        A trip can last from 15 minutes up to 36 hours. An
                        administrator must approve it.
                      </p>
                    )}
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
                        {subcategoryLabel(selectedResource.subcategory)} · Capacity{" "}
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
                    <FormField label="Purpose">
                      <input
                        required
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
                            : "Nothing matches this view."
                      }
                      actionLabel={
                        filter === "upcoming" ? "Browse resources" : undefined
                      }
                      onAction={
                        filter === "upcoming"
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
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">Notifications</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      Confirmations, completions, and cancellations on your account.
                    </p>
                  </div>
                  {activity.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="shrink-0 rounded-xl border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Clear
                    </button>
                  )}
                </div>
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
                      {data.user.role === "ADMIN"
                        ? "Admin"
                        : jobPositionLabel(data.user.jobPosition)}
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
                allowedToBook={
                  !isMeetingRoom(detailResource.category) ||
                  viewerCanBookMeetingRooms
                }
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

