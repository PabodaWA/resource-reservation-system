const OFFICE_OPEN_MINUTES = 8 * 60;
const OFFICE_CLOSE_MINUTES = 20 * 60;

type ZonedClock = {
  dayKey: string;
  minutes: number;
};

export function needsAdminApproval(start: Date, end: Date, timeZone: string) {
  const startClock = zonedClock(start, timeZone);
  const endClock = zonedClock(end, timeZone);

  if (!startClock || !endClock) {
    return true;
  }

  if (startClock.dayKey !== endClock.dayKey) {
    return true;
  }

  return (
    startClock.minutes < OFFICE_OPEN_MINUTES ||
    endClock.minutes > OFFICE_CLOSE_MINUTES
  );
}

function zonedClock(value: Date, timeZone: string): ZonedClock | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(value);
    const read = (type: Intl.DateTimeFormatPartTypes) =>
      parts.find((part) => part.type === type)?.value ?? "";
    const year = read("year");
    const month = read("month");
    const day = read("day");
    const hour = Number(read("hour"));
    const minute = Number(read("minute"));

    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
      return null;
    }

    return {
      dayKey: `${year}-${month}-${day}`,
      minutes: hour * 60 + minute,
    };
  } catch {
    return null;
  }
}
