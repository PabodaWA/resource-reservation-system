import { needsAdminApproval } from "@/lib/office-hours";

export const RESOURCE_CATALOG = [
  {
    value: "MEETING_ROOMS",
    label: "Meeting rooms",
    subcategories: [
      { value: "SMALL_MEETING_ROOM", label: "Small meeting room" },
      { value: "LARGE_BOARDROOM", label: "Large boardroom" },
      { value: "CLIENT_MEETING_ROOM", label: "Client meeting room" },
      { value: "VIDEO_CONFERENCE_ROOM", label: "Video-conference room" },
    ],
  },
  {
    value: "SHARED_EQUIPMENT",
    label: "Shared equipment",
    subcategories: [
      { value: "LAPTOP", label: "Laptop" },
      { value: "PROJECTOR", label: "Projector" },
      { value: "CAMERA", label: "Camera" },
      { value: "MICROPHONE", label: "Microphone" },
      { value: "SPEAKER", label: "Speaker" },
      { value: "PRESENTATION_CLICKER", label: "Presentation clicker" },
      { value: "PORTABLE_MONITOR", label: "Portable monitor" },
    ],
  },
  {
    value: "SHARED_WORKSPACES",
    label: "Shared desks and workspaces",
    subcategories: [
      { value: "HOT_DESK", label: "Hot desk" },
      { value: "TEMPORARY_WORKSTATION", label: "Temporary workstation" },
      { value: "QUIET_ROOM", label: "Quiet room" },
      { value: "COLLABORATION_SPACE", label: "Collaboration space" },
      { value: "PHONE_BOOTH", label: "Phone booth" },
    ],
  },
  {
    value: "COMPANY_VEHICLES",
    label: "Company vehicles",
    subcategories: [
      { value: "COMPANY_CAR", label: "Company car" },
      { value: "VAN", label: "Van" },
      { value: "BIKE", label: "Bike" },
      { value: "POOL_VEHICLE", label: "Pool vehicle" },
    ],
  },
  {
    value: "OTHER_FACILITIES",
    label: "Other shared facilities",
    subcategories: [
      { value: "PARKING_BAY", label: "Parking bay" },
      { value: "LOCKER", label: "Locker" },
      { value: "TRAINING_ROOM", label: "Training room" },
      { value: "EVENT_SPACE", label: "Event space" },
      { value: "CATERING", label: "Catering facility" },
      { value: "EV_CHARGING", label: "EV charging point" },
    ],
  },
] as const;

export type ResourceCategory = (typeof RESOURCE_CATALOG)[number]["value"];
export type ResourceSubcategory =
  (typeof RESOURCE_CATALOG)[number]["subcategories"][number]["value"];

const MEETING_ROOM_POSITIONS = new Set([
  "MANAGER",
  "TEAM_LEADER",
  "SCRUM_MASTER",
]);

export const MIN_BOOKING_MS = 15 * 60 * 1000;
export const STANDARD_MAX_BOOKING_MS = 12 * 60 * 60 * 1000;
export const VEHICLE_MAX_BOOKING_MS = 36 * 60 * 60 * 1000;

export function isResourceCategory(value: unknown): value is ResourceCategory {
  return RESOURCE_CATALOG.some((category) => category.value === value);
}

export function isResourceSubcategory(
  value: unknown
): value is ResourceSubcategory {
  return RESOURCE_CATALOG.some((category) =>
    category.subcategories.some((item) => item.value === value)
  );
}

export function subcategoriesFor(category: string) {
  return (
    RESOURCE_CATALOG.find((item) => item.value === category)?.subcategories ??
    []
  );
}

export function subcategoryBelongsToCategory(
  category: string,
  subcategory: string
) {
  return subcategoriesFor(category).some((item) => item.value === subcategory);
}

export function parseResourceClassification(
  category: unknown,
  subcategory: unknown
):
  | { ok: true; category: ResourceCategory; subcategory: ResourceSubcategory }
  | { ok: false; message: string } {
  if (
    !isResourceCategory(category) ||
    !isResourceSubcategory(subcategory) ||
    !subcategoryBelongsToCategory(category, subcategory)
  ) {
    return {
      ok: false,
      message: "Choose a category and a matching subcategory.",
    };
  }

  return { ok: true, category, subcategory };
}

export function categoryLabel(value: string) {
  return (
    RESOURCE_CATALOG.find((category) => category.value === value)?.label ??
    humanize(value)
  );
}

export function subcategoryLabel(value: string) {
  for (const category of RESOURCE_CATALOG) {
    const match = category.subcategories.find((item) => item.value === value);

    if (match) {
      return match.label;
    }
  }

  return humanize(value);
}

export function isCompanyVehicle(category: string | undefined) {
  return category === "COMPANY_VEHICLES";
}

export function isMeetingRoom(category: string | undefined) {
  return category === "MEETING_ROOMS";
}

export function canBookMeetingRoom(
  role: "ADMIN" | "MEMBER",
  jobPosition: string
) {
  if (role === "ADMIN") {
    return true;
  }

  return MEETING_ROOM_POSITIONS.has(jobPosition);
}

export function maxBookingDurationMs(category: string | undefined) {
  return isCompanyVehicle(category)
    ? VEHICLE_MAX_BOOKING_MS
    : STANDARD_MAX_BOOKING_MS;
}

export function bookingDurationMessage(category: string | undefined) {
  return isCompanyVehicle(category)
    ? "A vehicle booking must last between 15 minutes and 36 hours."
    : "A booking must last between 15 minutes and 12 hours.";
}

export function bookingNeedsApproval(
  category: string,
  start: Date,
  end: Date,
  timeZone: string
) {
  if (isCompanyVehicle(category)) {
    return true;
  }

  return needsAdminApproval(start, end, timeZone);
}

function humanize(value: string) {
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}
