import { type JobPosition } from "@/lib/job-position";
import { bookingDurationMessage, categoryLabel, maxBookingDurationMs, subcategoryLabel } from "@/lib/resource-catalog";
import { minimumPartySize } from "@/lib/reservation-participants";

export type UserDashboardData = {
  user: {
    id: string;
    name: string;
    email: string;
    role: "ADMIN" | "MEMBER";
    jobPosition: JobPosition;
  };
  resources: {
    id: string;
    name: string;
    category: string;
    subcategory: string;
    location: string;
    capacity: number;
    description: string | null;
    facilities: string | null;
    images: string[];
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
    resourceCategory: string;
    resourceSubcategory: string;
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

export type Section =
  | "overview"
  | "book"
  | "reservations"
  | "notifications"
  | "profile";
export type ReservationFilter = "upcoming" | "pending" | "past" | "cancelled";
export type DateWindow = "all" | "today" | "week" | "month";
export type BrowseSort = "az" | "za" | "capacity";
export type Availability = "Available" | "Limited" | "Unavailable";

export type Reservation = UserDashboardData["reservations"][number];
export type Resource = UserDashboardData["resources"][number];

export const sections: { id: Section | "favourites"; label: string }[] = [
  { id: "overview", label: "Dashboard" },
  { id: "book", label: "Browse Resources" },
  { id: "favourites", label: "Favourite Resources" },
  { id: "reservations", label: "My Reservations" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Profile" },
];

export const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

export const emptyBooking = {
  resourceId: "",
  title: "",
  purpose: "",
  category: "",
  date: "",
  startClock: "",
  endClock: "",
};

export type ParticipantDraft = {
  name: string;
  email: string;
};

export function emptyParty(capacity: number): ParticipantDraft[] {
  const others = Math.max(minimumPartySize(capacity) - 1, 0);

  return Array.from({ length: others }, () => ({ name: "", email: "" }));
}

export function formatClockLabel(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(2026, 0, 1, hours, minutes, 0, 0));
}

export const timeChoices = Array.from({ length: 24 * 4 }, (_, index) => {
  const hours = Math.floor(index / 4);
  const minutes = (index % 4) * 15;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return { value, label: formatClockLabel(value) };
});

export const MIN_DURATION_MS = 15 * 60 * 1000;
export const MAX_LEAD_MS = 90 * 24 * 60 * 60 * 1000;

export const bookingHours = Array.from({ length: 12 }, (_, index) => index + 8);

export function hourState(
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

export function dayLoad(
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

export function detailMonthDays(month: Date) {
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

export function formatHourDuration(ms: number) {
  const minutes = Math.round(ms / 60000);

  if (minutes === 60) {
    return "1 hour";
  }

  return formatDuration(ms);
}

export function resourceGallery(resource: {
  category: string;
  subcategory: string;
  name: string;
  location: string;
  images?: string[];
}) {
  const saved = savedResourcePhotos(resource);

  if (saved.length > 0) {
    return saved;
  }

  const primary = resourcePhoto(resource);
  const pool = resourcePhotos[visualKind(resource).id];
  return [primary, ...pool.filter((photo) => photo !== primary)].slice(0, 4);
}

export function resourceBlurb(resource: Resource) {
  const description = resource.description?.trim();

  if (description) {
    return description;
  }

  const people =
    resource.capacity === 1 ? "1 person" : `${resource.capacity} people`;

  return `A ${categoryHint(resource).toLowerCase()} for up to ${people} at ${resource.location}.`;
}

export function resourceFacilities(resource: Resource) {
  return resource.facilities?.trim() ?? "";
}

export function dateSummary(value: string) {
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

export function draftsFromReservation(reservation: Reservation, capacity: number) {
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

export function slotsExceptReservation(
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

export function ensureClockChoice(
  options: { value: string; label: string }[],
  value: string
) {
  if (!value || options.some((choice) => choice.value === value)) {
    return options;
  }

  return [{ value, label: formatEndChoice("", value) }, ...options];
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "U";
}

export function endsLaterDay(date: string, startClock: string, endValue: string) {
  if (!endValue) {
    return false;
  }

  if (endValue.includes("T")) {
    return !endValue.startsWith(`${date}T`);
  }

  return Boolean(startClock) && endValue <= startClock;
}

export function formatEndChoice(date: string, endValue: string) {
  if (!endValue) {
    return "";
  }

  if (endValue.includes("T")) {
    const [endDate, clock] = endValue.split("T");
    const day =
      date && endDate !== date ? ` (${formatBookingDate(endDate)})` : "";
    return `${formatClockLabel(clock)}${day}`;
  }

  return formatClockLabel(endValue);
}

export function defaultSlot() {
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

export function resolveSlot(
  date: string,
  startClock: string,
  endClock: string,
  maxDurationMs = maxBookingDurationMs(undefined)
) {
  if (!date || !startClock || !endClock) {
    return {
      window: null as { start: Date; end: Date } | null,
      error: "Choose a date and a start and end time.",
    };
  }

  const start = combineLocal(date, startClock);
  let end = endClock.includes("T")
    ? combineLocal(endClock.slice(0, 10), endClock.slice(11))
    : combineLocal(date, endClock);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return {
      window: null,
      error: "Choose a valid date and time.",
    };
  }

  if (!endClock.includes("T") && end.getTime() <= start.getTime()) {
    end = addDays(end, 1);
  }

  if (end.getTime() <= start.getTime()) {
    return {
      window: null,
      error: "End time must be after the start time.",
    };
  }

  const duration = end.getTime() - start.getTime();

  if (duration < MIN_DURATION_MS || duration > maxDurationMs) {
    return {
      window: null,
      error: bookingDurationMessage(
        maxDurationMs > 12 * 60 * 60 * 1000 ? "COMPANY_VEHICLES" : undefined
      ),
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

export function isResourceFree(
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

export function openStartChoices(
  date: string,
  resourceId: string,
  slots: UserDashboardData["occupiedSlots"],
  maxDurationMs = maxBookingDurationMs(undefined)
) {
  if (!date) {
    return [];
  }

  return timeChoices.filter((choice) => {
    const probe = new Date(
      combineLocal(date, choice.value).getTime() + MIN_DURATION_MS
    );
    const resolved = resolveSlot(
      date,
      choice.value,
      toClockInput(probe),
      maxDurationMs
    );

    return (
      resolved.window !== null &&
      isResourceFree(resourceId, resolved.window, slots)
    );
  });
}

export function openEndChoices(
  date: string,
  startClock: string,
  resourceId: string,
  slots: UserDashboardData["occupiedSlots"],
  maxDurationMs = maxBookingDurationMs(undefined)
) {
  if (!date || !startClock) {
    return [];
  }

  const start = combineLocal(date, startClock);
  const longBooking = maxDurationMs > 12 * 60 * 60 * 1000;
  const choices: { value: string; label: string }[] = [];

  for (
    let offset = MIN_DURATION_MS;
    offset <= maxDurationMs;
    offset += MIN_DURATION_MS
  ) {
    const end = new Date(start.getTime() + offset);
    const endClock = longBooking
      ? `${toDateInput(end)}T${toClockInput(end)}`
      : toClockInput(end);
    const resolved = resolveSlot(date, startClock, endClock, maxDurationMs);

    if (!resolved.window || !isResourceFree(resourceId, resolved.window, slots)) {
      if (choices.length > 0) {
        break;
      }

      continue;
    }

    const nextDay = end.toDateString() !== start.toDateString();
    choices.push({
      value: endClock,
      label: longBooking
        ? formatEndChoice(date, endClock)
        : `${formatClockLabel(toClockInput(end))}${nextDay ? " (next day)" : ""}`,
    });
  }

  return choices;
}

export function bookingWindowNote(
  date: string,
  startClock: string,
  endOptions: { value: string; label: string }[],
  maxDurationMs = maxBookingDurationMs(undefined)
) {
  if (!date || !startClock) {
    return "";
  }

  if (endOptions.length === 0) {
    return "There is no free 15-minute gap after this start time.";
  }

  const start = combineLocal(date, startClock);
  const last = endOptions[endOptions.length - 1];
  const resolved = resolveSlot(date, startClock, last.value, maxDurationMs);

  if (
    resolved.window &&
    resolved.window.end.getTime() < start.getTime() + maxDurationMs
  ) {
    return `You can book until ${last.label}. This resource is already reserved after that.`;
  }

  return "";
}

export function combineLocal(date: string, time: string) {
  const [year, month, day] = date.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

export function toDateInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toClockInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function addMonths(date: Date, count: number) {
  return new Date(date.getFullYear(), date.getMonth() + count, 1);
}

export function scheduleAnchor(reservations: Reservation[], todayKey: string) {
  for (const reservation of reservations) {
    if (reservationDayKeys(reservation).includes(todayKey)) {
      return todayKey;
    }
  }

  const next = reservations[0];

  if (!next) {
    return todayKey;
  }

  return reservationDayKeys(next)[0] ?? todayKey;
}

export function reservationDayKeys(reservation: Reservation) {
  const start = startOfDay(new Date(reservation.startTime));
  const end = new Date(reservation.endTime);
  const endsAtMidnight =
    end.getHours() === 0 &&
    end.getMinutes() === 0 &&
    end.getSeconds() === 0 &&
    end.getMilliseconds() === 0;
  const last = endsAtMidnight ? startOfDay(addDays(end, -1)) : startOfDay(end);
  const stop = last < start ? start : last;
  const keys: string[] = [];

  for (
    let cursor = new Date(start);
    cursor.getTime() <= stop.getTime() && keys.length < 14;
    cursor = addDays(cursor, 1)
  ) {
    keys.push(toDateInput(cursor));
  }

  return keys;
}

export function calendarDays(month: Date) {
  const firstWeekday = monthStart(month).getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: firstWeekday }, () => null);

  for (let day = 1; day <= count; day += 1) {
    cells.push(new Date(month.getFullYear(), month.getMonth(), day));
  }

  return cells;
}

export function formatBookingDate(date: string) {
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

export function formatDuration(ms: number) {
  const minutes = Math.round(ms / 60000);

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export type VisualKind = "room" | "projector" | "laptop" | "lab" | "hall";

export const resourcePhotos: Record<VisualKind, string[]> = {
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

export function savedResourcePhotos(resource: { images?: string[] }) {
  return (resource.images ?? []).filter((photo) => photo.trim()).slice(0, 4);
}

export function resourcePhoto(resource: {
  category: string;
  subcategory: string;
  name: string;
  location: string;
  images?: string[];
}) {
  const saved = savedResourcePhotos(resource);

  if (saved.length > 0) {
    return saved[0];
  }

  const blob = `${resource.subcategory} ${resource.name}`.toLowerCase();

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

export function visualKind(resource: {
  category: string;
  subcategory: string;
  name: string;
  location: string;
}) {
  if (
    resource.category === "SHARED_EQUIPMENT" &&
    (resource.subcategory === "LAPTOP" ||
      resource.subcategory === "PORTABLE_MONITOR")
  ) {
    return { id: "laptop" as const, gradient: "from-zinc-200 to-slate-500" };
  }

  if (resource.category === "SHARED_EQUIPMENT") {
    return { id: "projector" as const, gradient: "from-slate-200 to-slate-400" };
  }

  if (resource.category === "SHARED_WORKSPACES") {
    return { id: "lab" as const, gradient: "from-indigo-200 to-blue-500" };
  }

  if (
    resource.subcategory === "LARGE_BOARDROOM" ||
    resource.subcategory === "VIDEO_CONFERENCE_ROOM" ||
    resource.subcategory === "EVENT_SPACE" ||
    resource.subcategory === "TRAINING_ROOM" ||
    resource.category === "COMPANY_VEHICLES"
  ) {
    return { id: "hall" as const, gradient: "from-amber-100 to-orange-300" };
  }

  return { id: "room" as const, gradient: "from-sky-200 to-blue-400" };
}

export function categoryHint(resource: { category: string }) {
  return categoryLabel(resource.category);
}

export function matchesResource(
  resource: {
    name: string;
    category: string;
    subcategory: string;
    location: string;
    description: string | null;
    facilities?: string | null;
  },
  query: string
) {
  const term = query.trim().toLowerCase();

  if (!term) {
    return true;
  }

  return (
    resource.name.toLowerCase().includes(term) ||
    subcategoryLabel(resource.subcategory).toLowerCase().includes(term) ||
    categoryLabel(resource.category).toLowerCase().includes(term) ||
    resource.location.toLowerCase().includes(term) ||
    (resource.description ?? "").toLowerCase().includes(term) ||
    (resource.facilities ?? "").toLowerCase().includes(term)
  );
}

export function availabilityLabel(
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

export function buildActivity(reservations: Reservation[]) {
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

export function inDateWindow(iso: string, window: DateWindow) {
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

export function reservationSchedule(startIso: string, endIso: string) {
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

export function formatBookingLength(ms: number) {
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

export function formatShortDate(iso: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(iso));
}

export function formatClockSpan(startIso: string, endIso: string) {
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  return `${time.format(new Date(startIso))} - ${time.format(new Date(endIso))}`;
}

export function relativeTime(iso: string) {
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

export function formatRange(startIso: string, endIso: string) {
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
