import { jobPositionLabel, type JobPosition } from "@/lib/job-position";
import { categoryLabel, subcategoryLabel } from "@/lib/resource-catalog";

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
    jobPosition: JobPosition;
    isActive: boolean;
    lockedUntil: string | null;
    createdAt: string;
  }[];
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
    status: "ACTIVE" | "INACTIVE";
    createdAt: string;
    updatedAt: string;
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
    userId: string;
    userName: string;
    userEmail: string;
    userJobPosition: JobPosition;
    resourceName: string;
    resourceCategory: string;
    resourceSubcategory: string;
    resourceLocation: string;
    resourceCapacity: number;
    resourceDescription: string | null;
    resourceFacilities: string | null;
    participants: {
      name: string;
      email: string;
    }[];
  }[];
};

export type Section =
  | "dashboard"
  | "users"
  | "resources"
  | "reservations"
  | "pending"
  | "reports"
  | "notifications"
  | "profile";

export type ReservationFilter = "all" | "PENDING" | "CONFIRMED" | "CANCELLED";

export type ActivityKind = "reservation" | "resource" | "user" | "cancelled";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: string;
};

export type SearchHit = {
  id: string;
  kind: "User" | "Resource" | "Reservation";
  title: string;
  detail: string;
};

export const sections: { id: Section; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pending", label: "Pending Requests" },
  { id: "users", label: "Manage Users" },
  { id: "resources", label: "Manage Resources" },
  { id: "reservations", label: "Reservations" },
  { id: "reports", label: "Reports" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Profile" },
];

export const sectionCopy: Record<Section, { title: string; detail: string }> = {
  dashboard: {
    title: "Dashboard",
    detail: "Overview of resource usage and reservation activity.",
  },
  users: {
    title: "Manage Users",
    detail: "View, add, edit, and manage all system users.",
  },
  resources: {
    title: "Manage Resources",
    detail: "Add, edit, and manage all available resources.",
  },
  reservations: {
    title: "Reservations",
    detail: "Review and manage all resource reservations.",
  },
  pending: {
    title: "Pending Requests",
    detail: "Bookings waiting for your approval.",
  },
  reports: {
    title: "Reports",
    detail: "Weekly trends, plus downloads of every user, reservation, and resource.",
  },
  notifications: {
    title: "Notifications",
    detail: "Recent changes across users, resources, and reservations.",
  },
  profile: {
    title: "Profile",
    detail: "Your administrator account.",
  },
};

export const sliceColors = [
  "#2563EB",
  "#0284C7",
  "#7C3AED",
  "#DB2777",
  "#059669",
  "#EA580C",
];

export const inputClass =
  "w-full rounded-xl border border-[#E2EAF3] bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]";

export const emptyUser = {
  name: "",
  email: "",
  role: "MEMBER" as "ADMIN" | "MEMBER",
  jobPosition: "" as JobPosition | "",
};

export function isUserConfirmedBooking(
  reservation: { status: string; userId: string },
  adminId: string
) {
  return reservation.status === "CONFIRMED" && reservation.userId !== adminId;
}

export function isAccountLocked(lockedUntil: string | null) {
  return lockedUntil !== null && new Date(lockedUntil).getTime() > Date.now();
}

export function emailAlreadyUsed(
  users: { id: string; email: string }[],
  email: string,
  exceptUserId?: string
) {
  const normalized = email.trim().toLowerCase();

  return users.some(
    (user) =>
      user.id !== exceptUserId && user.email.trim().toLowerCase() === normalized
  );
}

export const emptyResource = {
  name: "",
  category: "",
  subcategory: "",
  location: "",
  capacity: "1",
  description: "",
  facilities: "",
  images: [] as string[],
  status: "ACTIVE" as "ACTIVE" | "INACTIVE",
};

export const USER_PAGE_SIZE = 8;

export async function readResourceImage(file: File) {
  if (
    file.type !== "image/jpeg" &&
    file.type !== "image/png" &&
    file.type !== "image/webp"
  ) {
    throw new Error("Choose a JPEG, PNG, or WebP photo.");
  }

  const bitmap = await createImageBitmap(file);
  const maxSide = 1280;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");

  if (!context) {
    bitmap.close();
    throw new Error("Could not read that photo.");
  }

  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  let quality = 0.82;
  let dataUrl = canvas.toDataURL("image/jpeg", quality);

  while (dataUrl.length > 550_000 && quality > 0.45) {
    quality -= 0.08;
    dataUrl = canvas.toDataURL("image/jpeg", Number(quality.toFixed(2)));
  }

  if (dataUrl.length > 700_000) {
    throw new Error("That photo is still too large. Try a smaller image.");
  }

  return dataUrl;
}

export function categoryStyle(category: string) {
  if (category === "Meeting rooms") {
    return "bg-[#E8F2FF] text-[#3B82F6]";
  }

  if (category === "Shared equipment") {
    return "bg-[#FFF4E5] text-[#D97706]";
  }

  if (category === "Shared desks and workspaces") {
    return "bg-[#E0F7FA] text-[#0E7490]";
  }

  if (category === "Company vehicles") {
    return "bg-[#E8F8EF] text-[#15803D]";
  }

  if (category === "Other shared facilities") {
    return "bg-[#F3E8FF] text-[#7C3AED]";
  }

  return "bg-slate-100 text-slate-600";
}

export function formatSlot(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(start);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  if (startIso === endIso) {
    return { day, time: time.format(start) };
  }

  return { day, time: `${time.format(start)} – ${time.format(end)}` };
}

export function formatDuration(startIso: string, endIso: string) {
  const minutes = Math.max(
    0,
    Math.round(
      (new Date(endIso).getTime() - new Date(startIso).getTime()) / 60000
    )
  );

  if (minutes < 60) {
    return `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (rest === 0) {
    return `${hours} hour${hours === 1 ? "" : "s"}`;
  }

  return `${hours}h ${rest}m`;
}

export function reservationStatus(
  reservation: AdminDashboardData["reservations"][number]
): {
  label: string;
  tone: "info" | "success" | "muted" | "warning" | "progress";
} {
  if (reservation.status === "PENDING") {
    return { label: "Pending", tone: "warning" };
  }

  if (reservation.status === "CANCELLED") {
    return { label: "Cancelled", tone: "muted" };
  }

  if (reservation.timing === "past") {
    return { label: "Completed", tone: "success" };
  }

  if (reservation.timing === "in_progress") {
    return { label: "In progress", tone: "progress" };
  }

  return { label: "Upcoming", tone: "info" };
}

export function buildWeekDays(
  reservations: AdminDashboardData["reservations"],
  weekStart: Date
) {
  return Array.from({ length: 7 }, (_, index) => {
    const day = addDays(weekStart, index);
    const next = addDays(day, 1);
    const value = reservations.filter(
      (reservation) =>
        reservation.status !== "CANCELLED" &&
        inRange(reservation.startTime, day, next)
    ).length;

    return {
      label: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(day),
      value,
    };
  });
}

export function buildUsage(resources: AdminDashboardData["resources"]) {
  const counts = new Map<string, number>();

  for (const resource of resources) {
    const label = categoryLabel(resource.category);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value)
    .map((slice, index) => ({
      ...slice,
      color: sliceColors[index % sliceColors.length],
    }));
}

export function buildActivity(data: AdminDashboardData): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const reservation of data.reservations) {
    items.push({
      id: `created-${reservation.id}`,
      kind: "reservation",
      title: "New reservation created",
      detail: `${reservation.userName} · ${reservation.resourceName}`,
      at: reservation.createdAt,
    });

    if (reservation.status === "CANCELLED") {
      items.push({
        id: `cancelled-${reservation.id}`,
        kind: "cancelled",
        title: "Reservation cancelled",
        detail: `${reservation.userName} · ${reservation.resourceName}`,
        at: reservation.updatedAt,
      });
    }
  }

  for (const user of data.users) {
    items.push({
      id: `user-${user.id}`,
      kind: "user",
      title: "New user registered",
      detail: user.name,
      at: user.createdAt,
    });
  }

  for (const resource of data.resources) {
    const created = new Date(resource.createdAt).getTime();
    const updated = new Date(resource.updatedAt).getTime();
    const changed = updated - created > 60_000;

    items.push({
      id: `resource-${resource.id}`,
      kind: "resource",
      title: changed ? "Resource updated" : "Resource added",
      detail: resource.name,
      at: changed ? resource.updatedAt : resource.createdAt,
    });
  }

  return items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()
  );
}

export function activityDot(kind: ActivityKind) {
  if (kind === "reservation") return "bg-emerald-600";
  if (kind === "resource") return "bg-[#D97706]";
  if (kind === "user") return "bg-[#2563EB]";
  return "bg-rose-600";
}

export function activityIconColor(kind: ActivityKind) {
  if (kind === "reservation") return "text-emerald-600";
  if (kind === "resource") return "text-[#D97706]";
  if (kind === "user") return "text-[#2563EB]";
  return "text-rose-600";
}

export function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Math.round(((current - previous) / previous) * 100);
}

export function inRange(iso: string, start: Date, end: Date) {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
}

export function startOfMonth(anchor: Date) {
  return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
}

export function shareOf(count: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((count / total) * 100);
}

export function pageList(current: number, count: number) {
  if (count <= 5) {
    return Array.from({ length: count }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(current - 2, count - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

export function avatarTone(id: string) {
  const tones = [
    "bg-[#E8F2FF] text-[#3B82F6]",
    "bg-[#F3E8FF] text-[#8B5CF6]",
    "bg-[#FCE7F3] text-[#DB2777]",
    "bg-[#FFEDD5] text-[#F59E0B]",
    "bg-[#DCFCE7] text-[#16A34A]",
  ];
  let hash = 0;

  for (const char of id) {
    hash = (hash + char.charCodeAt(0)) % tones.length;
  }

  return tones[hash];
}

export function formatJoined(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

export function startOfWeek(anchor: Date) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function axisMax(value: number) {
  if (value <= 0) {
    return 4;
  }

  return Math.max(4, Math.ceil(value / 4) * 4);
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "A";
}

export function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

export function formatShort(iso: string) {
  const date = new Date(iso);
  const day = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(date);
  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);

  return `${day}, ${time}`;
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

export function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(diff / 60000);

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.round(minutes / 60);

  if (hours < 24) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.round(hours / 24);

  if (days === 1) {
    return "Yesterday";
  }

  if (days < 7) {
    return `${days} days ago`;
  }

  return formatShort(iso).split(",")[0];
}

export function downloadUsersReport(users: AdminDashboardData["users"]) {
  downloadCsv(
    `users-${reportStamp()}.csv`,
    [
      "Name",
      "Email",
      "Role",
      "Job position",
      "Status",
      "Locked until",
      "Joined",
    ],
    users.map((user) => [
      user.name,
      user.email,
      user.role === "ADMIN" ? "Admin" : "Member",
      jobPositionLabel(user.jobPosition),
      user.isActive ? "Active" : "Inactive",
      user.lockedUntil ? formatReportDate(user.lockedUntil) : "",
      formatReportDate(user.createdAt),
    ])
  );
}

export function downloadReservationsReport(
  reservations: AdminDashboardData["reservations"]
) {
  downloadCsv(
    `reservations-${reportStamp()}.csv`,
    [
      "Title",
      "Purpose",
      "Status",
      "Start",
      "End",
      "Booked by",
      "Booker email",
      "Job position",
      "Resource",
      "Category",
      "Subcategory",
      "Location",
      "Capacity",
      "Participants",
      "Created",
      "Updated",
    ],
    reservations.map((reservation) => [
      reservation.title,
      reservation.purpose ?? "",
      reservationStatusLabel(reservation.status),
      formatReportDate(reservation.startTime),
      formatReportDate(reservation.endTime),
      reservation.userName,
      reservation.userEmail,
      jobPositionLabel(reservation.userJobPosition),
      reservation.resourceName,
      categoryLabel(reservation.resourceCategory),
      subcategoryLabel(reservation.resourceSubcategory),
      reservation.resourceLocation,
      String(reservation.resourceCapacity),
      reservation.participants
        .map((participant) => `${participant.name} <${participant.email}>`)
        .join("; "),
      formatReportDate(reservation.createdAt),
      formatReportDate(reservation.updatedAt),
    ])
  );
}

export function downloadResourcesReport(resources: AdminDashboardData["resources"]) {
  downloadCsv(
    `resources-${reportStamp()}.csv`,
    [
      "Name",
      "Category",
      "Subcategory",
      "Location",
      "Capacity",
      "Status",
      "Description",
      "Facilities",
      "Images",
      "Created",
      "Updated",
    ],
    resources.map((resource) => [
      resource.name,
      categoryLabel(resource.category),
      subcategoryLabel(resource.subcategory),
      resource.location,
      String(resource.capacity),
      resource.status === "ACTIVE" ? "Active" : "Inactive",
      resource.description ?? "",
      resource.facilities ?? "",
      String(resource.images.length),
      formatReportDate(resource.createdAt),
      formatReportDate(resource.updatedAt),
    ])
  );
}

export function reservationStatusLabel(
  status: AdminDashboardData["reservations"][number]["status"]
) {
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "PENDING") return "Pending";
  return "Cancelled";
}

export function downloadCsv(filename: string, headers: string[], rows: string[][]) {
  const lines = [headers, ...rows].map((row) => row.map(csvCell).join(","));
  const blob = new Blob([`\uFEFF${lines.join("\r\n")}`], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function csvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

export function reportStamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatReportDate(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
