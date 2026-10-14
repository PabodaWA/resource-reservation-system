export const MIN_BOOKING_MS = 15 * 60 * 1000;
export const MAX_BOOKING_MS = 12 * 60 * 60 * 1000;
export const MAX_LEAD_MS = 90 * 24 * 60 * 60 * 1000;
export const START_GRACE_MS = 60 * 1000;
const SLOT_MS = 15 * 60 * 1000;

export type BookingInterval = {
  start: Date;
  end: Date;
};

export type ClockChoice = {
  clock: string;
  available: boolean;
  reason: "" | "booked";
};

export function localDayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

export function instantFromClock(dayStart: Date, clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return new Date(NaN);
  }

  return new Date(
    dayStart.getFullYear(),
    dayStart.getMonth(),
    dayStart.getDate(),
    hours,
    minutes,
    0,
    0
  );
}

export function clockFromInstant(date: Date, dayStart: Date) {
  const minutesTotal = Math.round((date.getTime() - dayStart.getTime()) / 60000);
  const hours = Math.floor(minutesTotal / 60);
  const minutes = minutesTotal - hours * 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function startIsInsideBooking(start: Date, bookings: BookingInterval[]) {
  const time = start.getTime();

  return bookings.some(
    (booking) => time >= booking.start.getTime() && time < booking.end.getTime()
  );
}

export function rangesOverlap(
  start: Date,
  end: Date,
  bookings: BookingInterval[]
) {
  return bookings.some(
    (booking) =>
      booking.start.getTime() < end.getTime() &&
      booking.end.getTime() > start.getTime()
  );
}

export function latestBookableEnd(start: Date, bookings: BookingInterval[]) {
  let cap = start.getTime() + MAX_BOOKING_MS;

  for (const booking of bookings) {
    const when = booking.start.getTime();

    if (when > start.getTime() && when < cap) {
      cap = when;
    }
  }

  return new Date(cap);
}

export function startClocksForDay(options: {
  dayStart: Date;
  bookings: BookingInterval[];
  now: number;
}) {
  const horizon = options.dayStart.getTime() + 24 * 60 * 60 * 1000;
  const choices: ClockChoice[] = [];

  for (
    let cursor = options.dayStart.getTime();
    cursor < horizon;
    cursor += SLOT_MS
  ) {
    const start = new Date(cursor);

    if (start.getTime() < options.now - START_GRACE_MS) {
      continue;
    }

    if (start.getTime() > options.now + MAX_LEAD_MS) {
      continue;
    }

    if (startIsInsideBooking(start, options.bookings)) {
      choices.push({
        clock: clockFromInstant(start, options.dayStart),
        available: false,
        reason: "booked",
      });
      continue;
    }

    const cap = latestBookableEnd(start, options.bookings);

    if (cap.getTime() - start.getTime() < MIN_BOOKING_MS) {
      choices.push({
        clock: clockFromInstant(start, options.dayStart),
        available: false,
        reason: "booked",
      });
      continue;
    }

    choices.push({
      clock: clockFromInstant(start, options.dayStart),
      available: true,
      reason: "",
    });
  }

  return choices;
}

export function endClocksForStart(options: {
  dayStart: Date;
  start: Date;
  bookings: BookingInterval[];
}) {
  if (
    Number.isNaN(options.start.getTime()) ||
    startIsInsideBooking(options.start, options.bookings)
  ) {
    return [] as ClockChoice[];
  }

  const cap = latestBookableEnd(options.start, options.bookings);

  if (cap.getTime() - options.start.getTime() < MIN_BOOKING_MS) {
    return [] as ClockChoice[];
  }

  const choices: ClockChoice[] = [];
  const seen = new Set<string>();

  function push(date: Date) {
    if (
      date.getTime() <= options.start.getTime() ||
      date.getTime() > cap.getTime() ||
      date.getTime() - options.start.getTime() < MIN_BOOKING_MS
    ) {
      return;
    }

    const clock = clockFromInstant(date, options.dayStart);

    if (seen.has(clock)) {
      return;
    }

    seen.add(clock);
    choices.push({ clock, available: true, reason: "" });
  }

  for (
    let cursor = options.start.getTime() + MIN_BOOKING_MS;
    cursor <= cap.getTime();
    cursor += SLOT_MS
  ) {
    push(new Date(cursor));
  }

  push(cap);

  choices.sort(
    (a, b) =>
      instantFromClock(options.dayStart, a.clock).getTime() -
      instantFromClock(options.dayStart, b.clock).getTime()
  );

  return choices;
}

export function pickEndClock(
  ends: ClockChoice[],
  startClock: string,
  preferredEnd?: string
) {
  if (ends.length === 0) {
    return undefined;
  }

  if (preferredEnd) {
    const exact = ends.find((choice) => choice.clock === preferredEnd);

    if (exact) {
      return exact;
    }

    const preferredMinutes = clockMinutes(preferredEnd);
    const earlier = [...ends]
      .reverse()
      .find((choice) => clockMinutes(choice.clock) <= preferredMinutes);

    if (earlier) {
      return earlier;
    }
  }

  const halfHour = addMinutesToClock(startClock, 30);
  return ends.find((choice) => choice.clock === halfHour) ?? ends[0];
}

export function suggestClocks(options: {
  dayStart: Date;
  bookings: BookingInterval[];
  now: number;
  preferredStart?: string;
  preferredEnd?: string;
}) {
  const starts = startClocksForDay(options);
  const exact = options.preferredStart
    ? starts.find(
        (choice) => choice.clock === options.preferredStart && choice.available
      )
    : undefined;
  const preferredIndex = options.preferredStart
    ? starts.findIndex((choice) => choice.clock === options.preferredStart)
    : -1;
  const next =
    preferredIndex >= 0
      ? starts.slice(preferredIndex + 1).find((choice) => choice.available)
      : undefined;
  const start = exact ?? next ?? starts.find((choice) => choice.available);

  if (!start) {
    return {
      startClock: "",
      endClock: "",
      error: "This date is fully booked. Choose another date.",
    };
  }

  const ends = endClocksForStart({
    dayStart: options.dayStart,
    start: instantFromClock(options.dayStart, start.clock),
    bookings: options.bookings,
  });
  const end = pickEndClock(ends, start.clock, options.preferredEnd);

  if (!end) {
    return {
      startClock: start.clock,
      endClock: "",
      error: "No open time remains after that start.",
    };
  }

  return { startClock: start.clock, endClock: end.clock, error: "" };
}

export function validateBookingWindow(options: {
  start: Date;
  end: Date;
  bookings: BookingInterval[];
  now: number;
}) {
  if (
    Number.isNaN(options.start.getTime()) ||
    Number.isNaN(options.end.getTime())
  ) {
    return { ok: false as const, error: "Choose a valid date and time." };
  }

  if (options.end.getTime() <= options.start.getTime()) {
    return { ok: false as const, error: "End time must be after the start time." };
  }

  const duration = options.end.getTime() - options.start.getTime();

  if (duration < MIN_BOOKING_MS) {
    return {
      ok: false as const,
      error: "A booking must last at least 15 minutes.",
    };
  }

  if (duration > MAX_BOOKING_MS) {
    return { ok: false as const, error: "A booking can last up to 12 hours." };
  }

  if (options.start.getTime() < options.now - START_GRACE_MS) {
    return { ok: false as const, error: "Start time cannot be in the past." };
  }

  if (options.start.getTime() > options.now + MAX_LEAD_MS) {
    return {
      ok: false as const,
      error: "Bookings can be made up to 90 days ahead.",
    };
  }

  if (
    startIsInsideBooking(options.start, options.bookings) ||
    rangesOverlap(options.start, options.end, options.bookings)
  ) {
    return { ok: false as const, error: "That time is already booked." };
  }

  const cap = latestBookableEnd(options.start, options.bookings);

  if (options.end.getTime() > cap.getTime()) {
    return {
      ok: false as const,
      error: "You can only book until the next booking starts.",
    };
  }

  return { ok: true as const, error: "" };
}

export function visibleBookings(options: {
  dayStart: Date;
  start: Date | null;
  bookings: BookingInterval[];
}) {
  const dayEnd = new Date(
    options.dayStart.getFullYear(),
    options.dayStart.getMonth(),
    options.dayStart.getDate() + 1
  );
  const reach = options.start
    ? options.start.getTime() + MAX_BOOKING_MS
    : dayEnd.getTime();
  const horizon = new Date(Math.max(dayEnd.getTime(), reach));

  return options.bookings
    .filter(
      (booking) =>
        booking.start.getTime() < horizon.getTime() &&
        booking.end.getTime() > options.dayStart.getTime()
    )
    .sort((a, b) => a.start.getTime() - b.start.getTime());
}

function clockMinutes(clock: string) {
  const [hours, minutes] = clock.split(":").map(Number);
  return hours * 60 + minutes;
}

function addMinutesToClock(clock: string, minutes: number) {
  const [hours, mins] = clock.split(":").map(Number);
  const total = hours * 60 + mins + minutes;

  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
