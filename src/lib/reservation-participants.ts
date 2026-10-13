export type ReservationParticipantInput = {
  name: string;
  email: string;
};

export class ParticipantInputError extends Error {}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function parseParticipants(
  value: unknown
): ReservationParticipantInput[] {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new ParticipantInputError(
      "People joining this booking must be a list."
    );
  }

  if (value.length > 10000) {
    throw new ParticipantInputError(
      "Too many people were added to this booking."
    );
  }

  const participants: ReservationParticipantInput[] = [];
  const seen = new Set<string>();

  for (const item of value) {
    if (
      typeof item !== "object" ||
      item === null ||
      !("name" in item) ||
      !("email" in item) ||
      typeof item.name !== "string" ||
      typeof item.email !== "string"
    ) {
      throw new ParticipantInputError("Each person needs a name and an email.");
    }

    const name = item.name.trim().replace(/\s+/g, " ");
    const email = item.email.trim().toLowerCase();

    if (!name && !email) {
      continue;
    }

    if (!name || name.length > 80) {
      throw new ParticipantInputError(
        name
          ? "Each person's name must be between 1 and 80 characters."
          : "Each added person needs both a name and an email."
      );
    }

    if (!email || email.length > 254 || !EMAIL_PATTERN.test(email)) {
      throw new ParticipantInputError(`“${name}” needs a valid email address.`);
    }

    if (seen.has(email)) {
      throw new ParticipantInputError(
        "Each person needs a different email address."
      );
    }

    seen.add(email);
    participants.push({ name, email });
  }

  return participants;
}

export function minimumPartySize(capacity: number): number {
  if (capacity <= 1) {
    return 1;
  }

  return Math.ceil(capacity * 0.7);
}

export function assertParticipantCapacity(
  capacity: number,
  participants: ReservationParticipantInput[],
  bookerEmail: string
) {
  const booker = bookerEmail.trim().toLowerCase();

  if (participants.some((person) => person.email === booker)) {
    throw new ParticipantInputError(
      "You are already included. Add only the other people."
    );
  }

  if (capacity <= 1) {
    if (participants.length > 0) {
      throw new ParticipantInputError(
        "This resource fits one person, so the booking is only for you."
      );
    }

    return;
  }

  const minimum = minimumPartySize(capacity);
  const partySize = participants.length + 1;
  const extraSeats = capacity - 1;

  if (partySize < minimum) {
    const othersNeeded = minimum - 1;
    throw new ParticipantInputError(
      othersNeeded === 1
        ? `Add at least 1 other person. At least ${minimum} of ${capacity} seats must be filled.`
        : `Add at least ${othersNeeded} other people. At least ${minimum} of ${capacity} seats must be filled.`
    );
  }

  if (participants.length > extraSeats) {
    throw new ParticipantInputError(
      extraSeats === 1
        ? "You can add 1 other person. You already count as one."
        : `You can add up to ${extraSeats} other people. You already count as one.`
    );
  }
}

export function isValidTimeZone(value: string): boolean {
  if (!value || value.length > 100) {
    return false;
  }

  try {
    Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

export function formatBookingWindow(
  start: Date,
  end: Date,
  timeZone: string
): string {
  const date = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  });
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
  const startDay = date.format(start);
  const endDay = date.format(end);

  if (startDay === endDay) {
    return `${startDay}, ${time.format(start)} – ${time.format(end)} (${timeZone})`;
  }

  return `${startDay}, ${time.format(start)} – ${endDay}, ${time.format(end)} (${timeZone})`;
}
