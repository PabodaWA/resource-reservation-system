"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";
import {
  MEMBER_JOB_POSITIONS,
  isJobPosition,
  jobPositionLabel,
  type JobPosition,
} from "@/lib/job-position";
import {
  RESOURCE_CATALOG,
  categoryLabel,
  parseResourceClassification,
  subcategoryBelongsToCategory,
  subcategoryLabel,
  subcategoriesFor,
} from "@/lib/resource-catalog";
import { MAX_RESOURCE_IMAGES } from "@/lib/resource-images";
import {
  isResourceLocation,
  RESOURCE_LOCATIONS,
} from "@/lib/resource-locations";

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

type Section =
  | "dashboard"
  | "users"
  | "resources"
  | "reservations"
  | "pending"
  | "reports"
  | "notifications"
  | "profile";

type ReservationFilter = "all" | "PENDING" | "CONFIRMED" | "CANCELLED";

type ActivityKind = "reservation" | "resource" | "user" | "cancelled";

type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: string;
};

type SearchHit = {
  id: string;
  kind: "User" | "Resource" | "Reservation";
  title: string;
  detail: string;
};

const sections: { id: Section; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "pending", label: "Pending Requests" },
  { id: "users", label: "Manage Users" },
  { id: "resources", label: "Manage Resources" },
  { id: "reservations", label: "Reservations" },
  { id: "reports", label: "Reports" },
  { id: "notifications", label: "Notifications" },
  { id: "profile", label: "Profile" },
];

const sectionCopy: Record<Section, { title: string; detail: string }> = {
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

const sliceColors = [
  "#2563EB",
  "#0284C7",
  "#7C3AED",
  "#DB2777",
  "#059669",
  "#EA580C",
];

const inputClass =
  "w-full rounded-xl border border-[#E2EAF3] bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]";

const emptyUser = {
  name: "",
  email: "",
  role: "MEMBER" as "ADMIN" | "MEMBER",
  jobPosition: "" as JobPosition | "",
};

function isUserConfirmedBooking(
  reservation: { status: string; userId: string },
  adminId: string
) {
  return reservation.status === "CONFIRMED" && reservation.userId !== adminId;
}

function isAccountLocked(lockedUntil: string | null) {
  return lockedUntil !== null && new Date(lockedUntil).getTime() > Date.now();
}

function emailAlreadyUsed(
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

const emptyResource = {
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

export default function AdminDashboardClient({
  data,
}: {
  data: AdminDashboardData;
}) {
  const router = useRouter();
  const [section, setSection] = useState<Section>("dashboard");
  const [userForm, setUserForm] = useState(emptyUser);
  const [resourceForm, setResourceForm] = useState(emptyResource);
  const [userSearch, setUserSearch] = useState("");
  const [resourceSearch, setResourceSearch] = useState("");
  const [reservationSearch, setReservationSearch] = useState("");
  const [pendingSearch, setPendingSearch] = useState("");
  const [reservationFilter, setReservationFilter] =
    useState<ReservationFilter>("all");
  const [reservationResourceId, setReservationResourceId] = useState("all");
  const [reservationDateScope, setReservationDateScope] = useState<
    "all" | "week"
  >("all");
  const [reservationSort, setReservationSort] = useState<
    "newest" | "oldest" | "start"
  >("newest");
  const [reservationPage, setReservationPage] = useState(1);
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [savingUser, setSavingUser] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [unlockingUserId, setUnlockingUserId] = useState<string | null>(null);
  const [userRoleFilter, setUserRoleFilter] = useState<
    "all" | "ADMIN" | "MEMBER"
  >("all");
  const [userStatusFilter, setUserStatusFilter] = useState<
    "all" | "active" | "inactive"
  >("all");
  const [userSort, setUserSort] = useState<
    "name-asc" | "name-desc" | "joined-desc" | "joined-asc"
  >("name-asc");
  const [userPage, setUserPage] = useState(1);
  const [userModal, setUserModal] = useState<null | "create" | "edit">(null);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [savingResource, setSavingResource] = useState(false);
  const [deletingResourceId, setDeletingResourceId] = useState<string | null>(
    null
  );
  const [resourceCategory, setResourceCategory] = useState("all");
  const [resourceStatusFilter, setResourceStatusFilter] = useState<
    "all" | "ACTIVE" | "INACTIVE"
  >("all");
  const [resourceLocation, setResourceLocation] = useState("all");
  const [resourceSort, setResourceSort] = useState<
    "name-asc" | "name-desc" | "capacity-desc" | "joined-desc"
  >("name-asc");
  const [resourcePage, setResourcePage] = useState(1);
  const [resourceModal, setResourceModal] = useState<
    null | "create" | "edit" | "view"
  >(null);
  const [editingResourceId, setEditingResourceId] = useState<string | null>(
    null
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [clearedNoticeAt, setClearedNoticeAt] = useState(0);
  const [reviewingId, setReviewingId] = useState("");
  const [deletingReservationId, setDeletingReservationId] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const weekStart = startOfWeek(weekAnchor);
  const weekEnd = addDays(weekStart, 7);
  const previousStart = addDays(weekStart, -7);
  const currentWeek = startOfWeek(new Date()).getTime() === weekStart.getTime();

  const pendingReservations = data.reservations.filter(
    (reservation) => reservation.status === "PENDING"
  );
  const activeResources = data.resources.filter(
    (resource) => resource.status === "ACTIVE"
  );

  const weekDays = buildWeekDays(data.reservations, weekStart);
  const usage = buildUsage(data.resources);
  const noticeKey = `resourcehub-notices:${data.admin.id}`;
  const activity = useMemo(() => buildActivity(data), [data]);
  const notifications = useMemo(
    () =>
      activity.filter(
        (item) => new Date(item.at).getTime() > clearedNoticeAt
      ),
    [activity, clearedNoticeAt]
  );
  const recentActivity = notifications.slice(0, 4);
  const notificationCount = notifications.filter((item) => {
    return Date.now() - new Date(item.at).getTime() < 7 * 24 * 60 * 60 * 1000;
  }).length;

  useEffect(() => {
    const cleared = Number(localStorage.getItem(`${noticeKey}:cleared`) || 0);
    if (Number.isFinite(cleared)) {
      setClearedNoticeAt(cleared);
    }
  }, [noticeKey]);

  const weekBookings = data.reservations.filter(
    (reservation) =>
      reservation.status !== "CANCELLED" &&
      inRange(reservation.startTime, weekStart, weekEnd)
  );
  const previousBookings = data.reservations.filter(
    (reservation) =>
      reservation.status !== "CANCELLED" &&
      inRange(reservation.startTime, previousStart, weekStart)
  );
  const recentRows = (
    weekBookings.length > 0
      ? [...weekBookings].sort(
          (a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        )
      : [...data.reservations].sort(
          (a, b) =>
            Math.abs(new Date(a.startTime).getTime() - Date.now()) -
            Math.abs(new Date(b.startTime).getTime() - Date.now())
        )
  ).slice(0, 4);

  const categoryCount = new Set(
    data.resources.map((resource) => categoryLabel(resource.category))
  ).size;

  const userTrend = percentChange(
    data.users.filter((user) => inRange(user.createdAt, weekStart, weekEnd))
      .length,
    data.users.filter((user) =>
      inRange(user.createdAt, previousStart, weekStart)
    ).length
  );
  const resourceTrend = percentChange(
    data.resources.filter((resource) =>
      inRange(resource.createdAt, weekStart, weekEnd)
    ).length,
    data.resources.filter((resource) =>
      inRange(resource.createdAt, previousStart, weekStart)
    ).length
  );
  const reservationTrend = percentChange(
    weekBookings.length,
    previousBookings.length
  );
  const pendingTrend = percentChange(
    pendingReservations.filter((reservation) =>
      inRange(reservation.createdAt, weekStart, weekEnd)
    ).length,
    data.reservations.filter(
      (reservation) =>
        reservation.status === "PENDING" &&
        inRange(reservation.createdAt, previousStart, weekStart)
    ).length
  );

  const managedUsers = useMemo(() => {
    const term = userSearch.trim().toLowerCase();
    const filtered = data.users.filter((user) => {
      if (userRoleFilter !== "all" && user.role !== userRoleFilter) {
        return false;
      }

      if (userStatusFilter === "active" && !user.isActive) {
        return false;
      }

      if (userStatusFilter === "inactive" && user.isActive) {
        return false;
      }

      if (!term) {
        return true;
      }

      const roleLabel = user.role === "ADMIN" ? "admin" : "user";
      const positionLabel = jobPositionLabel(user.jobPosition).toLowerCase();
      const lockLabel = isAccountLocked(user.lockedUntil) ? "locked" : "";

      return (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term) ||
        roleLabel.includes(term) ||
        positionLabel.includes(term) ||
        lockLabel.includes(term)
      );
    });

    return filtered.sort((a, b) => {
      if (userSort === "name-desc") {
        return b.name.localeCompare(a.name);
      }

      if (userSort === "joined-desc") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      if (userSort === "joined-asc") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }

      return a.name.localeCompare(b.name);
    });
  }, [data.users, userSearch, userRoleFilter, userStatusFilter, userSort]);

  const managedResources = useMemo(() => {
    const term = resourceSearch.trim().toLowerCase();
    const filtered = data.resources.filter((resource) => {
      const category = categoryLabel(resource.category);

      if (resourceCategory !== "all" && category !== resourceCategory) {
        return false;
      }

      if (
        resourceStatusFilter !== "all" &&
        resource.status !== resourceStatusFilter
      ) {
        return false;
      }

      if (resourceLocation !== "all" && resource.location !== resourceLocation) {
        return false;
      }

      if (!term) {
        return true;
      }

      return (
        resource.name.toLowerCase().includes(term) ||
        category.toLowerCase().includes(term) ||
        subcategoryLabel(resource.subcategory).toLowerCase().includes(term) ||
        resource.location.toLowerCase().includes(term) ||
        (resource.facilities ?? "").toLowerCase().includes(term)
      );
    });

    return filtered.sort((a, b) => {
      if (resourceSort === "name-desc") {
        return b.name.localeCompare(a.name);
      }

      if (resourceSort === "capacity-desc") {
        return b.capacity - a.capacity;
      }

      if (resourceSort === "joined-desc") {
        return (
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      }

      return a.name.localeCompare(b.name);
    });
  }, [
    data.resources,
    resourceSearch,
    resourceCategory,
    resourceStatusFilter,
    resourceLocation,
    resourceSort,
  ]);

  const managedReservations = useMemo(() => {
    const term = reservationSearch.trim().toLowerCase();
    const filtered = data.reservations.filter((reservation) => {
      if (reservationFilter !== "all" && reservation.status !== reservationFilter) {
        return false;
      }

      if (
        reservationResourceId !== "all" &&
        reservation.resourceId !== reservationResourceId
      ) {
        return false;
      }

      if (
        reservationDateScope === "week" &&
        !inRange(reservation.startTime, weekStart, weekEnd)
      ) {
        return false;
      }

      if (!term) {
        return true;
      }

      return (
        reservation.title.toLowerCase().includes(term) ||
        reservation.userName.toLowerCase().includes(term) ||
        reservation.userEmail.toLowerCase().includes(term) ||
        reservation.resourceName.toLowerCase().includes(term) ||
        reservation.id.toLowerCase().includes(term)
      );
    });

    return filtered.sort((a, b) => {
      if (reservationSort === "oldest") {
        return (
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      }

      if (reservationSort === "start") {
        return (
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );
      }

      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [
    data.reservations,
    reservationFilter,
    reservationSearch,
    reservationResourceId,
    reservationDateScope,
    reservationSort,
    weekStart,
    weekEnd,
  ]);

  const searchHits = useMemo(() => {
    const term = query.trim().toLowerCase();

    if (!term) {
      return [];
    }

    const hits: SearchHit[] = [];

    for (const user of data.users) {
      if (
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      ) {
        hits.push({
          id: `user-${user.id}`,
          kind: "User",
          title: user.name,
          detail: user.email,
        });
      }
    }

    for (const resource of data.resources) {
      if (
        resource.name.toLowerCase().includes(term) ||
        subcategoryLabel(resource.subcategory).toLowerCase().includes(term) ||
        resource.location.toLowerCase().includes(term)
      ) {
        hits.push({
          id: `resource-${resource.id}`,
          kind: "Resource",
          title: resource.name,
          detail: `${categoryLabel(resource.category)} · ${subcategoryLabel(resource.subcategory)} · ${resource.location}`,
        });
      }
    }

    for (const reservation of data.reservations) {
      if (
        reservation.title.toLowerCase().includes(term) ||
        reservation.userName.toLowerCase().includes(term) ||
        reservation.resourceName.toLowerCase().includes(term)
      ) {
        hits.push({
          id: `reservation-${reservation.id}`,
          kind: "Reservation",
          title: reservation.title,
          detail: `${reservation.userName} · ${reservation.resourceName}`,
        });
      }
    }

    return hits.slice(0, 8);
  }, [data, query]);

  const busiestResources = data.resources
    .map((resource) => ({
      id: resource.id,
      name: resource.name,
      type: categoryLabel(resource.category),
      bookings: data.reservations.filter(
        (reservation) =>
          reservation.resourceId === resource.id &&
          reservation.status !== "CANCELLED" &&
          inRange(reservation.startTime, weekStart, weekEnd)
      ).length,
    }))
    .sort((a, b) => b.bookings - a.bookings)
    .slice(0, 6);

  function openSection(next: Section) {
    setError("");
    setSuccess("");
    setSection(next);
    setMobileOpen(false);
    setAccountOpen(false);
    setSearchOpen(false);
  }

  function clearNotifications() {
    const clearedAt = Date.now();
    setClearedNoticeAt(clearedAt);
    localStorage.setItem(`${noticeKey}:cleared`, String(clearedAt));
  }

  function pickHit(hit: SearchHit) {
    setQuery("");
    setSearchOpen(false);

    if (hit.kind === "User") {
      setUserSearch(hit.title);
      openSection("users");
      return;
    }

    if (hit.kind === "Resource") {
      setResourceSearch(hit.title);
      openSection("resources");
      return;
    }

    setReservationFilter("all");
    setReservationSearch(hit.title);
    openSection("reservations");
  }

  async function handleReview(
    reservationId: string,
    status: "CONFIRMED" | "CANCELLED"
  ) {
    setError("");
    setSuccess("");
    setReviewingId(reservationId);

    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to update this booking.");
      }

      setSuccess(payload.message || "Booking updated.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setReviewingId("");
    }
  }

  async function handleDeleteReservation(
    reservation: AdminDashboardData["reservations"][number]
  ) {
    setError("");
    setSuccess("");

    if (isUserConfirmedBooking(reservation, data.admin.id)) {
      setError("A confirmed booking made by a user cannot be deleted.");
      return false;
    }

    const stillBooked =
      reservation.status !== "CANCELLED" && reservation.timing !== "past";
    const confirmed = window.confirm(
      stillBooked
        ? `Delete “${reservation.title}”? This removes it permanently and emails the people on the booking.`
        : `Delete “${reservation.title}”? This removes it permanently.`
    );

    if (!confirmed) {
      return false;
    }

    setDeletingReservationId(reservation.id);

    try {
      const response = await fetch(`/api/reservations/${reservation.id}`, {
        method: "DELETE",
      });
      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to delete this reservation.");
      }

      setSuccess(payload.message || "Reservation deleted.");
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      return true;
    } finally {
      setDeletingReservationId("");
    }
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

  async function handleCreateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = userForm.name.trim();
    const email = userForm.email.trim();

    if (!name || name.length > 120) {
      setError("Name must be between 1 and 120 characters.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (emailAlreadyUsed(data.users, email)) {
      setError("An account with this email already exists.");
      return;
    }

    const jobPosition =
      userForm.role === "ADMIN" ? "ADMIN" : userForm.jobPosition;

    if (
      !isJobPosition(jobPosition) ||
      (jobPosition === "ADMIN" && userForm.role !== "ADMIN")
    ) {
      setError("Select a job position.");
      return;
    }

    setSavingUser(true);

    try {
      const response = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role: userForm.role,
          jobPosition,
        }),
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to create this user.");
      }

      setSuccess(
        `Created ${name}. Sign-in details were emailed to ${email}.`
      );
      setUserForm(emptyUser);
      setUserModal(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingUser(false);
    }
  }

  function openCreateUser() {
    setError("");
    setSuccess("");
    setUserForm(emptyUser);
    setEditingUserId(null);
    setUserModal("create");
  }

  function openEditUser(user: AdminDashboardData["users"][number]) {
    setError("");
    setSuccess("");
    setEditingUserId(user.id);
    setUserForm({
      name: user.name,
      email: user.email,
      role: user.role,
      jobPosition: user.jobPosition,
    });
    setUserModal("edit");
  }

  async function handleUpdateUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const editing = data.users.find((user) => user.id === editingUserId);

    if (!editing) {
      setError("That user is no longer available.");
      setUserModal(null);
      return;
    }

    const name = userForm.name.trim();
    const email = userForm.email.trim();
    const activeInput = event.currentTarget.elements.namedItem("isActive");
    const isActive =
      activeInput instanceof HTMLSelectElement
        ? activeInput.value === "active"
        : editing.isActive;

    if (!name || name.length > 120) {
      setError("Name must be between 1 and 120 characters.");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email address.");
      return;
    }

    if (emailAlreadyUsed(data.users, email, editing.id)) {
      setError("An account with this email already exists.");
      return;
    }

    const jobPosition =
      userForm.role === "ADMIN" ? "ADMIN" : userForm.jobPosition;

    if (!isJobPosition(jobPosition) || (jobPosition === "ADMIN" && userForm.role !== "ADMIN")) {
      setError("Select a job position.");
      return;
    }

    setSavingUser(true);

    try {
      const response = await fetch(`/api/users/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          role: userForm.role,
          jobPosition,
          isActive,
        }),
      });
      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to update this user.");
      }

      setSuccess(payload.message || "User updated.");
      setUserModal(null);
      setEditingUserId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser(user: AdminDashboardData["users"][number]) {
    setError("");
    setSuccess("");

    if (user.id === data.admin.id) {
      setError("You cannot deactivate your own account.");
      return;
    }

    if (!user.isActive) {
      setError(`${user.name} is already inactive.`);
      return;
    }

    const confirmed = window.confirm(
      `Deactivate ${user.name}? They will not be able to sign in until an administrator activates the account again. Existing reservations stay in place.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "DELETE",
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to deactivate this account.");
      }

      setSuccess(`${user.name} is now inactive.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function handleUnlockUser(user: AdminDashboardData["users"][number]) {
    setError("");
    setSuccess("");

    const confirmed = window.confirm(
      `Unlock ${user.name}? They will be able to sign in again.`
    );

    if (!confirmed) {
      return;
    }

    setUnlockingUserId(user.id);

    try {
      const response = await fetch(`/api/users/${user.id}/unlock`, {
        method: "POST",
      });
      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to unlock this account.");
      }

      setSuccess(payload.message || `${user.name} can sign in again.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUnlockingUserId(null);
    }
  }

  async function handleCreateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const name = resourceForm.name.trim();
    const location = resourceForm.location.trim();
    const description = resourceForm.description.trim();
    const facilities = resourceForm.facilities.trim();
    const capacity = Number(resourceForm.capacity);

    if (
      !subcategoryBelongsToCategory(
        resourceForm.category,
        resourceForm.subcategory
      )
    ) {
      setError("Choose a category and a matching subcategory.");
      return;
    }

    if (!name || name.length > 120) {
      setError("Resource name must be between 1 and 120 characters.");
      return;
    }

    if (!isResourceLocation(location)) {
      setError("Choose Garage A, Garage B, or a floor from 1st to 4th.");
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
      setError("Capacity must be a whole number between 1 and 10000.");
      return;
    }

    if (description.length > 1000) {
      setError("Description must be 1000 characters or fewer.");
      return;
    }

    if (facilities.length > 500) {
      setError("Facilities must be 500 characters or fewer.");
      return;
    }

    if (resourceForm.images.length > MAX_RESOURCE_IMAGES) {
      setError(`Add up to ${MAX_RESOURCE_IMAGES} photos.`);
      return;
    }

    setSavingResource(true);

    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: resourceForm.category,
          subcategory: resourceForm.subcategory,
          location,
          capacity,
          description: description || null,
          facilities: facilities || null,
          images: resourceForm.images,
        }),
      });

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to add this resource.");
      }

      setSuccess(`${name} is now available to book.`);
      setResourceForm(emptyResource);
      setResourceModal(null);
      setEditingResourceId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingResource(false);
    }
  }

  function fillResourceForm(resource: AdminDashboardData["resources"][number]) {
    setResourceForm({
      name: resource.name,
      category: resource.category,
      subcategory: resource.subcategory,
      location: resource.location,
      capacity: String(resource.capacity),
      description: resource.description ?? "",
      facilities: resource.facilities ?? "",
      images: resource.images,
      status: resource.status,
    });
  }

  function openCreateResource() {
    setError("");
    setSuccess("");
    setResourceForm(emptyResource);
    setEditingResourceId(null);
    setResourceModal("create");
  }

  function openEditResource(resource: AdminDashboardData["resources"][number]) {
    setError("");
    setSuccess("");
    setEditingResourceId(resource.id);
    fillResourceForm(resource);
    setResourceModal("edit");
  }

  function openViewResource(resource: AdminDashboardData["resources"][number]) {
    setError("");
    setSuccess("");
    setEditingResourceId(resource.id);
    fillResourceForm(resource);
    setResourceModal("view");
  }

  async function handleUpdateResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!editingResourceId) {
      setError("That resource is no longer available.");
      setResourceModal(null);
      return;
    }

    const name = resourceForm.name.trim();
    const location = resourceForm.location.trim();
    const description = resourceForm.description.trim();
    const facilities = resourceForm.facilities.trim();
    const capacity = Number(resourceForm.capacity);

    const currentResource = data.resources.find(
      (resource) => resource.id === editingResourceId
    );

    if (
      !parseResourceClassification(
        resourceForm.category,
        resourceForm.subcategory
      ).ok
    ) {
      setError("Choose a category and a matching subcategory.");
      return;
    }

    if (!name || name.length > 120) {
      setError("Resource name must be between 1 and 120 characters.");
      return;
    }

    const currentLocation = currentResource?.location;

    if (!isResourceLocation(location) && location !== currentLocation) {
      setError("Choose Garage A, Garage B, or a floor from 1st to 4th.");
      return;
    }

    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
      setError("Capacity must be a whole number between 1 and 10000.");
      return;
    }

    if (description.length > 1000) {
      setError("Description must be 1000 characters or fewer.");
      return;
    }

    if (facilities.length > 500) {
      setError("Facilities must be 500 characters or fewer.");
      return;
    }

    if (resourceForm.images.length > MAX_RESOURCE_IMAGES) {
      setError(`Add up to ${MAX_RESOURCE_IMAGES} photos.`);
      return;
    }

    setSavingResource(true);

    try {
      const response = await fetch(`/api/resources/${editingResourceId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          category: resourceForm.category,
          subcategory: resourceForm.subcategory,
          location,
          capacity,
          description: description || null,
          facilities: facilities || null,
          images: resourceForm.images,
          status: resourceForm.status,
        }),
      });
      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to update this resource.");
      }

      setSuccess(payload.message || "Resource updated.");
      setResourceModal(null);
      setEditingResourceId(null);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSavingResource(false);
    }
  }

  async function handleDeleteResource(
    resource: AdminDashboardData["resources"][number]
  ) {
    setError("");
    setSuccess("");

    const openBookings = data.reservations.filter(
      (reservation) =>
        reservation.resourceId === resource.id &&
        (reservation.status === "CONFIRMED" ||
          reservation.status === "PENDING") &&
        reservation.timing !== "past"
    );

    if (resource.status === "INACTIVE" && openBookings.length > 0) {
      setError(
        `${resource.name} still has upcoming reservations. You can delete it after they are finished.`
      );
      return;
    }

    const confirmed = window.confirm(
      resource.status === "INACTIVE"
        ? `Delete ${resource.name}? Upcoming reservations are finished. This removes the resource and its finished reservations.`
        : openBookings.length > 0
          ? `Mark ${resource.name} as unavailable? You can delete it after the upcoming reservations are finished.`
          : `Mark ${resource.name} as unavailable? You can delete it after that.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingResourceId(resource.id);

    try {
      const response = await fetch(`/api/resources/${resource.id}`, {
        method: "DELETE",
      });
      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to delete this resource.");
      }

      setSuccess(payload.message || `${resource.name} was updated.`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setDeletingResourceId(null);
    }
  }

  return (
    <div className="h-dvh overflow-hidden bg-[#F4F7FB] font-sans text-[#1E293B]">
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-slate-900/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#EEF2F6] bg-white px-4 py-6 transition-transform ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0`}
      >
        <button
          type="button"
          onClick={() => openSection("dashboard")}
          className="flex items-center gap-3 px-2 text-left"
        >
          <img
            src="/R%20logo.jpg"
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl object-contain"
          />
          <span className="min-w-0">
            <span className="block text-sm font-bold leading-tight tracking-tight text-slate-800">
              Ruhunu ResourceHub
            </span>
            <span className="mt-0.5 block text-[11px] leading-4 text-slate-400">
              Resource Reservation System
            </span>
          </span>
        </button>

        <p className="mb-3 mt-8 px-3 text-[11px] font-semibold tracking-[0.16em] text-slate-400">
          MENU
        </p>

        <nav className="flex-1 space-y-1 overflow-y-auto">
          {sections.map((item) => {
            const active = section === item.id;

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => openSection(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
                  active
                    ? "bg-[#E8F2FF] text-[#2F7CF6]"
                    : "text-slate-500 hover:bg-[#F5F8FB] hover:text-slate-700"
                }`}
              >
                <SectionIcon id={item.id} />
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.id === "pending" && pendingReservations.length > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#F59E0B] px-1.5 text-[11px] font-bold text-white">
                    {pendingReservations.length}
                  </span>
                )}
                {item.id === "notifications" && notificationCount > 0 && (
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EF4444] px-1.5 text-[11px] font-bold text-white">
                    {notificationCount > 9 ? "9+" : notificationCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mt-4 shrink-0 px-2 pb-2 text-center">
          <CampusArt />
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            Shared Resources
            <br />
            Stronger Together
          </p>
          <span className="mx-auto mt-2 block h-1 w-10 rounded-full bg-[#5B9DFF]" />
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

      <div className="flex h-full min-h-0 flex-col md:pl-[248px]">
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4 sm:px-5 lg:px-6 xl:overflow-hidden">
          <div className="flex shrink-0 items-center gap-3">
            <button
              type="button"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2EAF3] bg-white text-slate-500 md:hidden"
              aria-label="Open menu"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </button>

            <div className="relative min-w-0 flex-1">
              <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                <SearchIcon />
              </span>
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setSearchOpen(false);
                  }
                }}
                placeholder="Search users, resources, or reservations..."
                className="w-full rounded-full border border-[#E6EEF5] bg-white py-2.5 pl-11 pr-4 text-sm text-slate-700 shadow-[0_1px_2px_rgba(15,23,42,0.03)] outline-none placeholder:text-slate-400 focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
              />
              {searchOpen && query.trim() && (
                <div
                  className="absolute left-0 right-0 z-30 mt-2 overflow-hidden rounded-2xl border border-[#E7EEF6] bg-white shadow-lg"
                  onMouseDown={(event) => event.preventDefault()}
                >
                  {searchHits.length === 0 ? (
                    <p className="px-4 py-3 text-sm text-slate-500">
                      No matches for “{query.trim()}”.
                    </p>
                  ) : (
                    <ul>
                      {searchHits.map((hit) => (
                        <li key={hit.id}>
                          <button
                            type="button"
                            onClick={() => pickHit(hit)}
                            className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#F5F9FC]"
                          >
                            <span className="rounded-full bg-[#E8F2FF] px-2 py-0.5 text-[11px] font-semibold text-[#2F7CF6]">
                              {hit.kind}
                            </span>
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-semibold text-slate-700">
                                {hit.title}
                              </span>
                              <span className="block truncate text-xs text-slate-400">
                                {hit.detail}
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
              aria-label="Notifications"
              onClick={() => openSection("notifications")}
              className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-[#E6EEF5] bg-white text-slate-500 shadow-[0_1px_2px_rgba(15,23,42,0.03)]"
            >
              <BellIcon />
              {notificationCount > 0 && (
                <span className="absolute right-2.5 top-2.5 h-2 w-2 rounded-full bg-[#EF4444]" />
              )}
            </button>

            <div className="relative shrink-0">
              {accountOpen && (
                <button
                  type="button"
                  aria-label="Close account menu"
                  className="fixed inset-0 z-20 cursor-default"
                  onClick={() => setAccountOpen(false)}
                />
              )}
              <button
                type="button"
                onClick={() => setAccountOpen((open) => !open)}
                className="relative z-30 flex items-center gap-3 rounded-full py-1 pl-1 pr-2 text-left"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#3B82F6] text-sm font-bold text-white">
                  {initials(data.admin.name)}
                </span>
                <span className="hidden sm:block">
                  <span className="block text-sm font-semibold leading-tight text-slate-800">
                    {data.admin.name}
                  </span>
                  <span className="block text-xs text-slate-400">
                    {data.admin.email}
                  </span>
                </span>
                <ChevronIcon />
              </button>
              {accountOpen && (
                <div className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-[#E7EEF6] bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    onClick={() => openSection("profile")}
                    className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-[#F5F8FB]"
                  >
                    Profile
                  </button>
                  <a
                    href="/change-password"
                    className="block px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-[#F5F8FB]"
                  >
                    Change password
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleLogout()}
                    disabled={loggingOut}
                    className="block w-full px-4 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                  >
                    {loggingOut ? "Logging out..." : "Log out"}
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-4 flex shrink-0 flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-800">
                {sectionCopy[section].title}
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                {sectionCopy[section].detail}
              </p>
            </div>
            {section === "users" && (
              <button
                type="button"
                onClick={openCreateUser}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563EB]"
              >
                <PlusIcon />
                Add User
              </button>
            )}
            {section === "resources" && (
              <button
                type="button"
                onClick={openCreateResource}
                className="inline-flex items-center gap-2 rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-[#2563EB]"
              >
                <PlusIcon />
                Add Resource
              </button>
            )}
            {(section === "dashboard" || section === "reports") && (
              <div className="flex items-center gap-2">
                {!currentWeek && (
                  <button
                    type="button"
                    onClick={() => setWeekAnchor(new Date())}
                    className="text-xs font-semibold text-[#2F7CF6]"
                  >
                    This week
                  </button>
                )}
                <div className="flex items-center rounded-xl border border-[#E6EEF5] bg-white px-1.5 py-1.5 text-sm text-slate-600 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
                  <button
                    type="button"
                    aria-label="Previous week"
                    onClick={() =>
                      setWeekAnchor((current) => addDays(current, -7))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
                  >
                    <ChevronLeftIcon />
                  </button>
                  <span className="flex items-center gap-2 px-2">
                    <CalendarIcon />
                    {formatDay(weekStart)} – {formatDay(addDays(weekEnd, -1))}
                  </span>
                  <button
                    type="button"
                    aria-label="Next week"
                    onClick={() =>
                      setWeekAnchor((current) => addDays(current, 7))
                    }
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
                  >
                    <ChevronRightIcon />
                  </button>
                </div>
              </div>
            )}
          </div>

          <div
            className={
              section === "dashboard" ||
              section === "users" ||
              section === "resources" ||
              section === "pending" ||
              section === "reservations"
                ? "mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden"
                : "mt-4 min-h-0 flex-1 space-y-5 overflow-y-auto"
            }
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
                {success}
              </div>
            )}

            {section === "dashboard" && (
              <>
                <section className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <StatCard
                    label="Total Users"
                    value={data.users.length}
                    change={userTrend}
                    caption="from last week"
                    tone="blue"
                    icon={<UsersIcon />}
                  />
                  <StatCard
                    label="Total Resources"
                    value={data.resources.length}
                    change={resourceTrend}
                    caption={`${categoryCount} ${categoryCount === 1 ? "category" : "categories"}`}
                    tone="purple"
                    icon={<LayersIcon />}
                  />
                  <StatCard
                    label="Total Reservations"
                    value={data.reservations.length}
                    change={reservationTrend}
                    caption="this week"
                    tone="green"
                    icon={<CalendarIcon />}
                  />
                  <StatCard
                    label="Pending Requests"
                    value={pendingReservations.length}
                    change={pendingTrend}
                    caption="awaiting approval"
                    tone="orange"
                    alert
                    icon={<ClockIcon />}
                    onClick={() => openSection("pending")}
                  />
                </section>

                <section className="grid min-h-[220px] flex-1 gap-3 xl:min-h-0 xl:grid-cols-5">
                  <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white p-4 shadow-[0_8px_24px_rgba(15,42,68,0.04)] xl:col-span-3">
                    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
                        <span className="text-[#2563EB]">
                          <ChartIcon />
                        </span>
                        Reservations This Week
                      </h2>
                      <span className="flex items-center gap-2 text-xs text-slate-400">
                        <span className="h-2 w-2 rounded-full bg-[#2563EB]" />
                        Total Reservations
                      </span>
                    </div>
                    <WeekBars days={weekDays} />
                  </article>

                  <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white p-4 shadow-[0_8px_24px_rgba(15,42,68,0.04)] xl:col-span-2">
                    <h2 className="flex shrink-0 items-center gap-2 text-base font-semibold text-slate-700">
                      <span className="text-[#6D28D9]">
                        <DonutIcon />
                      </span>
                      Resource Usage
                    </h2>
                    <UsageDonut slices={usage} total={data.resources.length} />
                  </article>
                </section>

                <section className="grid min-h-[220px] flex-1 gap-3 xl:min-h-0 xl:grid-cols-5">
                  <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white p-4 shadow-[0_8px_24px_rgba(15,42,68,0.04)] xl:col-span-3">
                    <div className="flex shrink-0 items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
                        <span className="text-[#2563EB]">
                          <CalendarIcon />
                        </span>
                        Recent Reservations
                      </h2>
                      <button
                        type="button"
                        onClick={() => {
                          setReservationFilter("all");
                          openSection("reservations");
                        }}
                        className="text-sm font-semibold text-[#2F7CF6]"
                      >
                        View all
                      </button>
                    </div>
                    {recentRows.length === 0 ? (
                      <EmptyState
                        title="No reservations yet"
                        detail="Bookings will show up in this table."
                      />
                    ) : (
                      <div className="mt-3 min-h-0 flex-1 overflow-auto">
                        <table className="w-full min-w-[520px] text-left text-sm">
                          <thead>
                            <tr className="text-xs font-medium text-slate-400">
                              <th className="pb-3 font-medium">User</th>
                              <th className="pb-3 font-medium">Resource</th>
                              <th className="pb-3 font-medium">Date & Time</th>
                              <th className="pb-3 font-medium">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {recentRows.map((reservation) => {
                              const status = reservationStatus(reservation);

                              return (
                                <tr
                                  key={reservation.id}
                                  className="border-t border-[#F1F5F9]"
                                >
                                  <td className="py-2.5 pr-3 font-medium text-slate-700">
                                    {reservation.userName}
                                  </td>
                                  <td className="py-2.5 pr-3 text-slate-500">
                                    {reservation.resourceName}
                                  </td>
                                  <td className="py-2.5 pr-3 text-slate-500">
                                    {formatShort(reservation.startTime)}
                                  </td>
                                  <td className="py-2.5">
                                    <Badge tone={status.tone}>{status.label}</Badge>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </article>

                  <article className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white p-4 shadow-[0_8px_24px_rgba(15,42,68,0.04)] xl:col-span-2">
                    <div className="flex shrink-0 items-center justify-between gap-3">
                      <h2 className="flex items-center gap-2 text-base font-semibold text-slate-700">
                        <span className="text-[#D97706]">
                          <ClockIcon />
                        </span>
                        Recent Activity
                      </h2>
                      <button
                        type="button"
                        onClick={() => openSection("notifications")}
                        className="text-sm font-semibold text-[#2F7CF6]"
                      >
                        View all
                      </button>
                    </div>
                    <ActivityList
                      items={recentActivity}
                      onOpen={(kind) =>
                        openSection(
                          kind === "user"
                            ? "users"
                            : kind === "resource"
                              ? "resources"
                              : "reservations"
                        )
                      }
                    />
                  </article>
                </section>
              </>
            )}

            {section === "users" && (
              <UsersPanel
                users={data.users}
                managedUsers={managedUsers}
                page={userPage}
                search={userSearch}
                roleFilter={userRoleFilter}
                statusFilter={userStatusFilter}
                sort={userSort}
                deletingUserId={deletingUserId}
                unlockingUserId={unlockingUserId}
                currentUserId={data.admin.id}
                onSearch={(value) => {
                  setUserSearch(value);
                  setUserPage(1);
                }}
                onRole={(value) => {
                  setUserRoleFilter(value);
                  setUserPage(1);
                }}
                onStatus={(value) => {
                  setUserStatusFilter(value);
                  setUserPage(1);
                }}
                onSort={(value) => {
                  setUserSort(value);
                  setUserPage(1);
                }}
                onPage={setUserPage}
                onEdit={openEditUser}
                onUnlock={(user) => void handleUnlockUser(user)}
                onDelete={(user) => void handleDeleteUser(user)}
              />
            )}

            {section === "resources" && (
              <ResourcesPanel
                resources={data.resources}
                managedResources={managedResources}
                page={resourcePage}
                search={resourceSearch}
                category={resourceCategory}
                statusFilter={resourceStatusFilter}
                location={resourceLocation}
                sort={resourceSort}
                deletingResourceId={deletingResourceId}
                onSearch={(value) => {
                  setResourceSearch(value);
                  setResourcePage(1);
                }}
                onCategory={(value) => {
                  setResourceCategory(value);
                  setResourcePage(1);
                }}
                onStatus={(value) => {
                  setResourceStatusFilter(value);
                  setResourcePage(1);
                }}
                onLocation={(value) => {
                  setResourceLocation(value);
                  setResourcePage(1);
                }}
                onSort={(value) => {
                  setResourceSort(value);
                  setResourcePage(1);
                }}
                onPage={setResourcePage}
                onView={openViewResource}
                onEdit={openEditResource}
                onDelete={(resource) => void handleDeleteResource(resource)}
              />
            )}
            {section === "pending" && (
              <PendingRequests
                requests={pendingReservations}
                adminId={data.admin.id}
                search={pendingSearch}
                reviewingId={reviewingId}
                deletingId={deletingReservationId}
                onSearch={setPendingSearch}
                onReview={(id, status) => void handleReview(id, status)}
                onDelete={handleDeleteReservation}
              />
            )}

            {section === "reservations" && (
              <ReservationsPanel
                reservations={data.reservations}
                visible={managedReservations}
                adminId={data.admin.id}
                resources={data.resources}
                search={reservationSearch}
                status={reservationFilter}
                resourceId={reservationResourceId}
                dateScope={reservationDateScope}
                sort={reservationSort}
                page={reservationPage}
                weekStart={weekStart}
                weekEnd={weekEnd}
                reviewingId={reviewingId}
                deletingId={deletingReservationId}
                onSearch={(value) => {
                  setReservationSearch(value);
                  setReservationPage(1);
                }}
                onStatus={(value) => {
                  setReservationFilter(value);
                  setReservationPage(1);
                }}
                onResource={(value) => {
                  setReservationResourceId(value);
                  setReservationPage(1);
                }}
                onDateScope={(value) => {
                  setReservationDateScope(value);
                  setReservationPage(1);
                }}
                onSort={(value) => {
                  setReservationSort(value);
                  setReservationPage(1);
                }}
                onPage={setReservationPage}
                onShiftWeek={(days) =>
                  setWeekAnchor((current) => addDays(current, days))
                }
                onReview={(id, status) => void handleReview(id, status)}
                onDelete={handleDeleteReservation}
              />
            )}
            {section === "reports" && (
              <section className="grid gap-4 xl:grid-cols-5">
                <article className="rounded-2xl border border-[#E8EEF5] bg-white p-5 shadow-[0_8px_24px_rgba(15,42,68,0.04)] xl:col-span-5">
                  <h2 className="text-base font-semibold text-slate-700">
                    Download reports
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    Save a spreadsheet of every user, reservation, or resource.
                    Passwords are not included.
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <ReportDownload
                      title="All user details"
                      detail={`${data.users.length} ${data.users.length === 1 ? "user" : "users"}`}
                      onDownload={() => downloadUsersReport(data.users)}
                    />
                    <ReportDownload
                      title="All reservation details"
                      detail={`${data.reservations.length} ${data.reservations.length === 1 ? "reservation" : "reservations"}`}
                      onDownload={() =>
                        downloadReservationsReport(data.reservations)
                      }
                    />
                    <ReportDownload
                      title="All resource details"
                      detail={`${data.resources.length} ${data.resources.length === 1 ? "resource" : "resources"}`}
                      onDownload={() => downloadResourcesReport(data.resources)}
                    />
                  </div>
                </article>
                <article className="rounded-2xl border border-[#E8EEF5] bg-white p-5 shadow-[0_8px_24px_rgba(15,42,68,0.04)] xl:col-span-3">
                  <h2 className="text-base font-semibold text-slate-700">
                    Bookings by day
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {weekBookings.length} reservations are scheduled this week.
                  </p>
                  <WeekBars days={weekDays} />
                </article>
                <article className="rounded-2xl border border-[#E8EEF5] bg-white p-5 shadow-[0_8px_24px_rgba(15,42,68,0.04)] xl:col-span-2">
                  <h2 className="text-base font-semibold text-slate-700">
                    Resources by category
                  </h2>
                  <UsageDonut slices={usage} total={data.resources.length} />
                </article>
                <article className="rounded-2xl border border-[#E8EEF5] bg-white p-5 shadow-[0_8px_24px_rgba(15,42,68,0.04)] xl:col-span-5">
                  <h2 className="text-base font-semibold text-slate-700">
                    Busiest resources
                  </h2>
                  {busiestResources.length === 0 ? (
                    <EmptyState
                      title="No resources yet"
                      detail="Add a resource to see how often it is booked."
                    />
                  ) : (
                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead>
                          <tr className="text-xs text-slate-400">
                            <th className="pb-3 font-medium">Resource</th>
                            <th className="pb-3 font-medium">Category</th>
                            <th className="pb-3 font-medium">Bookings this week</th>
                          </tr>
                        </thead>
                        <tbody>
                          {busiestResources.map((resource) => (
                            <tr
                              key={resource.id}
                              className="border-t border-[#F1F5F9]"
                            >
                              <td className="py-3 font-medium text-slate-700">
                                {resource.name}
                              </td>
                              <td className="py-3 text-slate-500">{resource.type}</td>
                              <td className="py-3 text-slate-700">
                                {resource.bookings}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </article>
              </section>
            )}

            {section === "notifications" && (
              <section className="rounded-2xl border border-[#E8EEF5] bg-white p-5 shadow-[0_8px_24px_rgba(15,42,68,0.04)] sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Recent activity</h2>
                    <p className="mt-1 text-sm text-slate-500">
                      New accounts, resource changes, and reservation updates.
                    </p>
                  </div>
                  {notifications.length > 0 && (
                    <button
                      type="button"
                      onClick={clearNotifications}
                      className="shrink-0 rounded-xl border border-[#E2EAF3] px-3.5 py-2 text-sm font-semibold text-slate-700 hover:bg-[#F5F8FB]"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <ActivityList
                  items={notifications.slice(0, 30)}
                  onOpen={(kind) =>
                    openSection(
                      kind === "user"
                        ? "users"
                        : kind === "resource"
                          ? "resources"
                          : "reservations"
                    )
                  }
                />
              </section>
            )}

            {section === "profile" && (
              <section className="max-w-xl rounded-2xl border border-[#E8EEF5] bg-white p-6 shadow-[0_8px_24px_rgba(15,42,68,0.04)]">
                <div className="flex items-center gap-4">
                  <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#3B82F6] text-xl font-bold text-white">
                    {initials(data.admin.name)}
                  </span>
                  <div>
                    <h2 className="text-xl font-bold text-slate-800">
                      {data.admin.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">{data.admin.email}</p>
                    <div className="mt-2">
                      <Badge tone="info">System Administrator</Badge>
                    </div>
                  </div>
                </div>
                <p className="mt-6 text-sm leading-6 text-slate-500">
                  You manage users, resources, and reservations for Ruhunu
                  ResourceHub.
                </p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <a
                    href="/change-password"
                    className="rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB]"
                  >
                    Change password
                  </a>
                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={loggingOut}
                  className="rounded-xl border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
                >
                  {loggingOut ? "Logging out..." : "Log out"}
                </button>
                </div>
              </section>
            )}
          </div>
        </div>
      </div>

      {resourceModal && (
        <ResourceDialog
          mode={resourceModal}
          form={resourceForm}
          saving={savingResource}
          resource={data.resources.find(
            (item) => item.id === editingResourceId
          )}
          onChange={setResourceForm}
          onClose={() => setResourceModal(null)}
          onEdit={() => setResourceModal("edit")}
          onCreate={(event) => void handleCreateResource(event)}
          onUpdate={(event) => void handleUpdateResource(event)}
        />
      )}

      {userModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setUserModal(null);
            }
          }}
        >
          <form
            key={userModal === "edit" ? (editingUserId ?? "edit") : "create"}
            onSubmit={(event) =>
              void (userModal === "edit"
                ? handleUpdateUser(event)
                : handleCreateUser(event))
            }
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-bold text-slate-800">
              {userModal === "edit" ? "Edit user" : "Add user"}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              {userModal === "edit"
                ? "Update this person's name, email, role, job position, or status."
                : "They receive a temporary password by email, then choose their own."}
            </p>
            {error && (
              <p
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <label className="mt-5 block text-sm font-medium text-slate-700">
              Full name
              <input
                required
                value={userForm.name}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                maxLength={120}
                className={`${inputClass} mt-2`}
                placeholder="Alex Fernando"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Email
              <input
                required
                type="email"
                value={userForm.email}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    email: event.target.value,
                  }))
                }
                maxLength={254}
                autoComplete="off"
                className={`${inputClass} mt-2`}
                placeholder="alex@example.com"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Role
              <select
                value={userForm.role}
                onChange={(event) => {
                  const role =
                    event.target.value === "ADMIN" ? "ADMIN" : "MEMBER";

                  setUserForm((current) => ({
                    ...current,
                    role,
                    jobPosition:
                      role === "ADMIN"
                        ? "ADMIN"
                        : current.jobPosition === "ADMIN"
                          ? ""
                          : current.jobPosition,
                  }));
                }}
                className={`${inputClass} mt-2`}
              >
                <option value="MEMBER">User</option>
                <option value="ADMIN">Administrator</option>
              </select>
            </label>

            <label className="mt-4 block text-sm font-medium text-slate-700">
              Job position
              <select
                required
                disabled={userForm.role === "ADMIN"}
                value={userForm.role === "ADMIN" ? "ADMIN" : userForm.jobPosition}
                onChange={(event) =>
                  setUserForm((current) => ({
                    ...current,
                    jobPosition: isJobPosition(event.target.value)
                      ? event.target.value
                      : "",
                  }))
                }
                className={`${inputClass} mt-2 disabled:bg-slate-50 disabled:text-slate-500`}
              >
                {userForm.role === "ADMIN" ? (
                  <option value="ADMIN">Admin</option>
                ) : (
                  <>
                    <option value="" disabled>
                      Select a job position
                    </option>
                    {MEMBER_JOB_POSITIONS.map((position) => (
                      <option key={position.value} value={position.value}>
                        {position.label}
                      </option>
                    ))}
                  </>
                )}
              </select>
            </label>

            {userModal === "edit" && (
              <label className="mt-4 block text-sm font-medium text-slate-700">
                Status
                <select
                  name="isActive"
                  defaultValue={
                    data.users.find((user) => user.id === editingUserId)
                      ?.isActive
                      ? "active"
                      : "inactive"
                  }
                  className={`${inputClass} mt-2`}
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </label>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setUserModal(null)}
                className="rounded-xl border border-[#E2EAF3] px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingUser}
                className="rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
              >
                {savingUser
                  ? "Saving..."
                  : userModal === "edit"
                    ? "Save changes"
                    : "Add user"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

const USER_PAGE_SIZE = 8;

function UsersPanel({
  users,
  managedUsers,
  page,
  search,
  roleFilter,
  statusFilter,
  sort,
  deletingUserId,
  unlockingUserId,
  currentUserId,
  onSearch,
  onRole,
  onStatus,
  onSort,
  onPage,
  onEdit,
  onUnlock,
  onDelete,
}: {
  users: AdminDashboardData["users"];
  managedUsers: AdminDashboardData["users"];
  page: number;
  search: string;
  roleFilter: "all" | "ADMIN" | "MEMBER";
  statusFilter: "all" | "active" | "inactive";
  sort: "name-asc" | "name-desc" | "joined-desc" | "joined-asc";
  deletingUserId: string | null;
  unlockingUserId: string | null;
  currentUserId: string;
  onSearch: (value: string) => void;
  onRole: (value: "all" | "ADMIN" | "MEMBER") => void;
  onStatus: (value: "all" | "active" | "inactive") => void;
  onSort: (
    value: "name-asc" | "name-desc" | "joined-desc" | "joined-asc"
  ) => void;
  onPage: (page: number) => void;
  onEdit: (user: AdminDashboardData["users"][number]) => void;
  onUnlock: (user: AdminDashboardData["users"][number]) => void;
  onDelete: (user: AdminDashboardData["users"][number]) => void;
}) {
  const total = users.length;
  const activeCount = users.filter((user) => user.isActive).length;
  const inactiveCount = total - activeCount;
  const adminCount = users.filter((user) => user.role === "ADMIN").length;
  const monthStart = startOfMonth(new Date());
  const previousMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() - 1,
    1
  );
  const nextMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1
  );
  const monthTrend = percentChange(
    users.filter((user) => inRange(user.createdAt, monthStart, nextMonth))
      .length,
    users.filter((user) => inRange(user.createdAt, previousMonth, monthStart))
      .length
  );
  const pageCount = Math.max(
    1,
    Math.ceil(managedUsers.length / USER_PAGE_SIZE)
  );
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * USER_PAGE_SIZE;
  const rows = managedUsers.slice(startIndex, startIndex + USER_PAGE_SIZE);
  const showingFrom = managedUsers.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + rows.length, managedUsers.length);
  const pages = pageList(currentPage, pageCount);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UserMetric
          label="Total Users"
          value={total}
          icon={<UsersIcon />}
          iconClass="bg-[#E8F2FF] text-[#3B82F6]"
          change={monthTrend}
          caption="from last month"
        />
        <UserMetric
          label="Active Users"
          value={activeCount}
          icon={<UserIcon />}
          iconClass="bg-[#E8F8EF] text-[#22A06B]"
          caption={`${shareOf(activeCount, total)}% of all users`}
        />
        <UserMetric
          label="Inactive Users"
          value={inactiveCount}
          icon={<UserIcon />}
          iconClass="bg-[#FFF4E5] text-[#F5A524]"
          caption={`${shareOf(inactiveCount, total)}% of all users`}
        />
        <UserMetric
          label="Administrators"
          value={adminCount}
          icon={<ShieldIcon />}
          iconClass="bg-[#F3E8FF] text-[#8B5CF6]"
          caption={`${shareOf(adminCount, total)}% of all users`}
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search by name, email, role, or job position..."
            className="h-11 w-full rounded-xl border border-[#E2EAF3] bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
          />
        </div>
        <select
          value={roleFilter}
          onChange={(event) =>
            onRole(
              event.target.value === "ADMIN"
                ? "ADMIN"
                : event.target.value === "MEMBER"
                  ? "MEMBER"
                  : "all"
            )
          }
          className="h-11 rounded-xl border border-[#E2EAF3] bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
        >
          <option value="all">All Roles</option>
          <option value="MEMBER">User</option>
          <option value="ADMIN">Admin</option>
        </select>
        <select
          value={statusFilter}
          onChange={(event) =>
            onStatus(
              event.target.value === "active"
                ? "active"
                : event.target.value === "inactive"
                  ? "inactive"
                  : "all"
            )
          }
          className="h-11 rounded-xl border border-[#E2EAF3] bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E2EAF3] bg-white px-3 text-sm text-slate-500">
          Sort by
          <select
            value={sort}
            onChange={(event) => {
              const value = event.target.value;
              onSort(
                value === "name-desc" ||
                  value === "joined-desc" ||
                  value === "joined-asc"
                  ? value
                  : "name-asc"
              );
            }}
            className="bg-transparent font-medium text-slate-700 outline-none"
          >
            <option value="name-asc">Name (A - Z)</option>
            <option value="name-desc">Name (Z - A)</option>
            <option value="joined-desc">Joined (newest)</option>
            <option value="joined-asc">Joined (oldest)</option>
          </select>
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white shadow-[0_8px_24px_rgba(15,42,68,0.04)]">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#F1F5F9] text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-2 py-3 font-medium">User</th>
                <th className="px-2 py-3 font-medium">Email</th>
                <th className="px-2 py-3 font-medium">Role</th>
                <th className="px-2 py-3 font-medium">Job position</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 font-medium">Joined Date</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No users match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((user, index) => (
                  <tr key={user.id} className="border-b border-[#F8FAFC]">
                    <td className="px-4 py-3 text-slate-400">
                      {startIndex + index + 1}
                    </td>
                    <td className="px-2 py-3">
                      <span className="flex items-center gap-3">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone(user.id)}`}
                        >
                          {initials(user.name)}
                        </span>
                        <span className="font-semibold text-slate-700">
                          {user.name}
                        </span>
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-500">{user.email}</td>
                    <td className="px-2 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          user.role === "ADMIN"
                            ? "bg-[#F3E8FF] text-[#7C3AED]"
                            : "bg-[#E8F2FF] text-[#3B82F6]"
                        }`}
                      >
                        {user.role === "ADMIN" ? "Admin" : "User"}
                      </span>
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      {jobPositionLabel(user.jobPosition)}
                    </td>
                    <td className="px-2 py-3">
                      {isAccountLocked(user.lockedUntil) ? (
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-600">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          Locked
                        </span>
                      ) : (
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            user.isActive ? "text-emerald-500" : "text-rose-500"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              user.isActive ? "bg-emerald-500" : "bg-rose-500"
                            }`}
                          />
                          {user.isActive ? "Active" : "Inactive"}
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-3 text-slate-500">
                      {formatJoined(user.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="flex justify-end gap-2">
                        {isAccountLocked(user.lockedUntil) && (
                          <button
                            type="button"
                            disabled={unlockingUserId !== null}
                            onClick={() => onUnlock(user)}
                            className="h-8 rounded-lg border border-amber-200 px-2.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60"
                          >
                            {unlockingUserId === user.id ? "Unlocking..." : "Unlock"}
                          </button>
                        )}
                        <button
                          type="button"
                          aria-label={`Edit ${user.name}`}
                          onClick={() => onEdit(user)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 hover:bg-[#F5F9FC] hover:text-[#3B82F6]"
                        >
                          <PencilIcon />
                        </button>
                        {user.id !== currentUserId && (
                          <button
                            type="button"
                            aria-label={
                              user.isActive
                                ? `Deactivate ${user.name}`
                                : `${user.name} is already inactive`
                            }
                            title={
                              user.isActive
                                ? "Deactivate account"
                                : "Already inactive"
                            }
                            disabled={deletingUserId !== null || !user.isActive}
                            onClick={() => onDelete(user)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                          >
                            <TrashIcon />
                          </button>
                        )}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] px-4 py-3">
          <p className="text-sm text-slate-400">
            Showing {showingFrom} to {showingTo} of {managedUsers.length} users
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => onPage(currentPage - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 disabled:opacity-40"
            >
              <ChevronLeftIcon />
            </button>
            {pages.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onPage(item)}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                  item === currentPage
                    ? "bg-[#3B82F6] text-white"
                    : "border border-[#E6EEF5] text-slate-500"
                }`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage >= pageCount}
              onClick={() => onPage(currentPage + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 disabled:opacity-40"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function UserMetric({
  label,
  value,
  icon,
  iconClass,
  caption,
  change,
  alert = false,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  iconClass: string;
  caption: string;
  change?: number;
  alert?: boolean;
}) {
  const trendTone =
    change === undefined
      ? ""
      : change > 0
        ? alert
          ? "text-rose-500"
          : "text-emerald-500"
        : change < 0
          ? alert
            ? "text-emerald-500"
            : "text-rose-500"
          : "text-slate-400";
  const arrow =
    change === undefined ? "" : change > 0 ? "↑" : change < 0 ? "↓" : "•";
  const signed =
    change === undefined ? "" : `${change > 0 ? "+" : ""}${change}%`;

  return (
    <article className="flex items-center gap-4 rounded-2xl border border-[#E8EEF5] bg-white px-4 py-4 shadow-[0_8px_24px_rgba(15,42,68,0.04)]">
      <div
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconClass}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-2xl font-bold tracking-tight text-slate-800">
          {value}
        </p>
        {change === undefined ? (
          <p className="text-xs text-slate-400">{caption}</p>
        ) : (
          <p className="text-xs leading-5">
            <span className={`font-semibold ${trendTone}`}>
              {arrow} {signed}
            </span>
            <span className="mt-0.5 block text-slate-400">{caption}</span>
          </p>
        )}
      </div>
    </article>
  );
}

function ResourcesPanel({
  resources,
  managedResources,
  page,
  search,
  category,
  statusFilter,
  location,
  sort,
  deletingResourceId,
  onSearch,
  onCategory,
  onStatus,
  onLocation,
  onSort,
  onPage,
  onView,
  onEdit,
  onDelete,
}: {
  resources: AdminDashboardData["resources"];
  managedResources: AdminDashboardData["resources"];
  page: number;
  search: string;
  category: string;
  statusFilter: "all" | "ACTIVE" | "INACTIVE";
  location: string;
  sort: "name-asc" | "name-desc" | "capacity-desc" | "joined-desc";
  deletingResourceId: string | null;
  onSearch: (value: string) => void;
  onCategory: (value: string) => void;
  onStatus: (value: "all" | "ACTIVE" | "INACTIVE") => void;
  onLocation: (value: string) => void;
  onSort: (
    value: "name-asc" | "name-desc" | "capacity-desc" | "joined-desc"
  ) => void;
  onPage: (page: number) => void;
  onView: (resource: AdminDashboardData["resources"][number]) => void;
  onEdit: (resource: AdminDashboardData["resources"][number]) => void;
  onDelete: (resource: AdminDashboardData["resources"][number]) => void;
}) {
  const total = resources.length;
  const monthStart = startOfMonth(new Date());
  const previousMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() - 1,
    1
  );
  const nextMonth = new Date(
    monthStart.getFullYear(),
    monthStart.getMonth() + 1,
    1
  );
  const monthTrend = percentChange(
    resources.filter((resource) =>
      inRange(resource.createdAt, monthStart, nextMonth)
    ).length,
    resources.filter((resource) =>
      inRange(resource.createdAt, previousMonth, monthStart)
    ).length
  );
  const categoryCounts = new Map<string, number>();

  for (const resource of resources) {
    const label = categoryLabel(resource.category);
    categoryCounts.set(label, (categoryCounts.get(label) ?? 0) + 1);
  }

  const topCategories = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 3);
  const categoryOptions = [...categoryCounts.keys()].sort((a, b) =>
    a.localeCompare(b)
  );
  const locationOptions = [
    ...new Set([
      ...RESOURCE_LOCATIONS,
      ...resources.map((resource) => resource.location),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const metricTones = [
    "bg-[#E8F8EF] text-[#22A06B]",
    "bg-[#F3E8FF] text-[#8B5CF6]",
    "bg-[#FFF4E5] text-[#F5A524]",
  ];
  const pageCount = Math.max(
    1,
    Math.ceil(managedResources.length / USER_PAGE_SIZE)
  );
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * USER_PAGE_SIZE;
  const rows = managedResources.slice(startIndex, startIndex + USER_PAGE_SIZE);
  const showingFrom = managedResources.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(
    startIndex + rows.length,
    managedResources.length
  );
  const pages = pageList(currentPage, pageCount);
  const filterClass =
    "h-11 rounded-xl border border-[#E2EAF3] bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]";

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UserMetric
          label="Total Resources"
          value={total}
          icon={<LayersIcon />}
          iconClass="bg-[#E8F2FF] text-[#3B82F6]"
          change={monthTrend}
          caption="from last month"
        />
        {topCategories.map(([label, count], index) => (
          <UserMetric
            key={label}
            label={label}
            value={count}
            icon={<CategoryGlyph category={label} />}
            iconClass={metricTones[index] ?? metricTones[0]}
            caption={`${shareOf(count, total)}% of all resources`}
          />
        ))}
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search by name, category, or location..."
            className="h-11 w-full rounded-xl border border-[#E2EAF3] bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
          />
        </div>
        <select
          value={category}
          onChange={(event) => onCategory(event.target.value)}
          className={filterClass}
        >
          <option value="all">All Categories</option>
          {categoryOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(event) =>
            onStatus(
              event.target.value === "ACTIVE"
                ? "ACTIVE"
                : event.target.value === "INACTIVE"
                  ? "INACTIVE"
                  : "all"
            )
          }
          className={filterClass}
        >
          <option value="all">All Statuses</option>
          <option value="ACTIVE">Available</option>
          <option value="INACTIVE">Not Available</option>
        </select>
        <select
          value={location}
          onChange={(event) => onLocation(event.target.value)}
          className={filterClass}
        >
          <option value="all">All Locations</option>
          {locationOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E2EAF3] bg-white px-3 text-sm text-slate-500">
          Sort by
          <select
            value={sort}
            onChange={(event) => {
              const value = event.target.value;
              onSort(
                value === "name-desc" ||
                  value === "capacity-desc" ||
                  value === "joined-desc"
                  ? value
                  : "name-asc"
              );
            }}
            className="bg-transparent font-medium text-slate-700 outline-none"
          >
            <option value="name-asc">Name (A - Z)</option>
            <option value="name-desc">Name (Z - A)</option>
            <option value="capacity-desc">Capacity</option>
            <option value="joined-desc">Newest</option>
          </select>
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white shadow-[0_8px_24px_rgba(15,42,68,0.04)]">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#F1F5F9] text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-2 py-3 font-medium">Resource Name</th>
                <th className="px-2 py-3 font-medium">Category</th>
                <th className="px-2 py-3 font-medium">Subcategory</th>
                <th className="px-2 py-3 font-medium">Location</th>
                <th className="px-2 py-3 font-medium">Capacity</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No resources match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((resource, index) => {
                  const group = categoryLabel(resource.category);

                  return (
                    <tr key={resource.id} className="border-b border-[#F8FAFC]">
                      <td className="px-4 py-3 text-slate-400">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${categoryStyle(group)}`}
                          >
                            <CategoryGlyph category={group} />
                          </span>
                          <span className="font-semibold text-slate-700">
                            {resource.name}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${categoryStyle(group)}`}
                        >
                          {group}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        {subcategoryLabel(resource.subcategory)}
                      </td>
                      <td className="px-2 py-3 text-slate-500">
                        {resource.location}
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        <span className="inline-flex items-center gap-1.5">
                          <UsersIcon />
                          {resource.capacity}
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 text-xs font-semibold ${
                            resource.status === "ACTIVE"
                              ? "text-emerald-500"
                              : "text-rose-500"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${
                              resource.status === "ACTIVE"
                                ? "bg-emerald-500"
                                : "bg-rose-500"
                            }`}
                          />
                          {resource.status === "ACTIVE"
                            ? "Available"
                            : "Not Available"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex justify-end gap-2">
                          <button
                            type="button"
                            aria-label={`View ${resource.name}`}
                            onClick={() => onView(resource)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 hover:bg-[#F5F9FC] hover:text-[#3B82F6]"
                          >
                            <EyeIcon />
                          </button>
                          <button
                            type="button"
                            aria-label={`Edit ${resource.name}`}
                            onClick={() => onEdit(resource)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 hover:bg-[#F5F9FC] hover:text-[#3B82F6]"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            aria-label={`Delete ${resource.name}`}
                            disabled={deletingResourceId !== null}
                            onClick={() => onDelete(resource)}
                            className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#FECACA] text-rose-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-60"
                          >
                            <TrashIcon />
                          </button>
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] px-4 py-3">
          <p className="text-sm text-slate-400">
            Showing {showingFrom} to {showingTo} of {managedResources.length}{" "}
            resources
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => onPage(currentPage - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 disabled:opacity-40"
            >
              <ChevronLeftIcon />
            </button>
            {pages.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onPage(item)}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                  item === currentPage
                    ? "bg-[#3B82F6] text-white"
                    : "border border-[#E6EEF5] text-slate-500"
                }`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage >= pageCount}
              onClick={() => onPage(currentPage + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 disabled:opacity-40"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

async function readResourceImage(file: File) {
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

function ResourceDialog({
  mode,
  form,
  saving,
  resource,
  onChange,
  onClose,
  onEdit,
  onCreate,
  onUpdate,
}: {
  mode: "create" | "edit" | "view";
  form: typeof emptyResource;
  saving: boolean;
  resource: AdminDashboardData["resources"][number] | undefined;
  onChange: (form: typeof emptyResource) => void;
  onClose: () => void;
  onEdit: () => void;
  onCreate: (event: FormEvent<HTMLFormElement>) => void;
  onUpdate: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const subcategoryChoices = subcategoriesFor(form.category);
  const locationChoices = (
    RESOURCE_LOCATIONS as readonly string[]
  ).includes(form.location)
    ? RESOURCE_LOCATIONS
    : form.location
      ? [form.location, ...RESOURCE_LOCATIONS]
      : RESOURCE_LOCATIONS;
  const [photoError, setPhotoError] = useState("");
  const [readingPhotos, setReadingPhotos] = useState(false);

  async function addPhotos(files: FileList | null) {
    if (!files || files.length === 0) {
      return;
    }

    const room = MAX_RESOURCE_IMAGES - form.images.length;

    if (room <= 0) {
      setPhotoError(`You can add up to ${MAX_RESOURCE_IMAGES} photos.`);
      return;
    }

    setPhotoError("");
    setReadingPhotos(true);

    try {
      const next = [...form.images];

      for (const file of Array.from(files).slice(0, room)) {
        next.push(await readResourceImage(file));
      }

      if (files.length > room) {
        setPhotoError(
          `Only ${MAX_RESOURCE_IMAGES} photos can be saved. Extra files were skipped.`
        );
      }

      onChange({ ...form, images: next });
    } catch (err) {
      setPhotoError(
        err instanceof Error ? err.message : "Could not read that photo."
      );
    } finally {
      setReadingPhotos(false);
    }
  }

  if (mode === "view" && resource) {
    const category = categoryLabel(resource.category);

    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
          <div className="flex items-center gap-3">
            <span
              className={`flex h-11 w-11 items-center justify-center rounded-xl ${categoryStyle(category)}`}
            >
              <CategoryGlyph category={category} />
            </span>
            <div>
              <h2 className="text-lg font-bold text-slate-800">
                {resource.name}
              </h2>
              <p className="text-sm text-slate-400">
                {category} · {subcategoryLabel(resource.subcategory)}
              </p>
            </div>
          </div>
          <dl className="mt-5 space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Location</dt>
              <dd className="text-right font-medium text-slate-700">
                {resource.location}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Capacity</dt>
              <dd className="font-medium text-slate-700">{resource.capacity}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Status</dt>
              <dd className="font-medium text-slate-700">
                {resource.status === "ACTIVE" ? "Available" : "Not Available"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-400">Facilities</dt>
              <dd className="text-right font-medium text-slate-700">
                {resource.facilities?.trim() || "Not listed"}
              </dd>
            </div>
            {resource.description && (
              <div>
                <dt className="text-slate-400">Description</dt>
                <dd className="mt-1 text-slate-700">{resource.description}</dd>
              </div>
            )}
            <div>
              <dt className="text-slate-400">Photos</dt>
              {resource.images.length === 0 ? (
                <dd className="mt-1 text-slate-500">
                  No photos yet. Edit this resource to add them.
                </dd>
              ) : (
                <dd className="mt-2 grid grid-cols-2 gap-2">
                  {resource.images.map((photo, index) => (
                    <img
                      key={`${index}-${photo.slice(0, 32)}`}
                      src={photo}
                      alt=""
                      className="h-24 w-full rounded-lg object-cover"
                    />
                  ))}
                </dd>
              )}
            </div>
          </dl>
          <div className="mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[#E2EAF3] px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              Close
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB]"
            >
              Edit
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={mode === "edit" ? onUpdate : onCreate}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 className="text-lg font-bold text-slate-800">
          {mode === "edit" ? "Edit resource" : "Add resource"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {mode === "edit"
            ? "Update the details members see when they book."
            : "Active resources appear on the booking page right away."}
        </p>

        <label className="mt-5 block text-sm font-medium text-slate-700">
          Category
          <select
            required
            value={form.category}
            onChange={(event) => {
              const category = event.target.value;
              const stillValid = subcategoriesFor(category).some(
                (item) => item.value === form.subcategory
              );

              onChange({
                ...form,
                category,
                subcategory: stillValid ? form.subcategory : "",
              });
            }}
            className={`${inputClass} mt-2`}
          >
            <option value="" disabled>
              Select a category
            </option>
            {RESOURCE_CATALOG.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Subcategory
          <select
            required
            value={form.subcategory}
            disabled={!form.category}
            onChange={(event) =>
              onChange({ ...form, subcategory: event.target.value })
            }
            className={`${inputClass} mt-2 disabled:bg-slate-50`}
          >
            <option value="" disabled>
              {form.category ? "Select a subcategory" : "Choose a category first"}
            </option>
            {subcategoryChoices.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        {form.category === "MEETING_ROOMS" && (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Only a manager, team leader, or scrum master can book a meeting room.
          </p>
        )}
        {form.category === "COMPANY_VEHICLES" && (
          <p className="mt-2 text-xs leading-5 text-slate-500">
            Vehicle trips can last from 15 minutes to 36 hours, and an
            administrator must approve each booking.
          </p>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Name
          <input
            required
            value={form.name}
            onChange={(event) =>
              onChange({ ...form, name: event.target.value })
            }
            maxLength={120}
            className={`${inputClass} mt-2`}
            placeholder="Boardroom A"
          />
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Location
          <select
            required
            value={form.location}
            onChange={(event) =>
              onChange({ ...form, location: event.target.value })
            }
            className={`${inputClass} mt-2`}
          >
            <option value="" disabled>
              Select a location
            </option>
            {locationChoices.map((location) => (
              <option key={location} value={location}>
                {location}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Capacity
          <input
            required
            type="number"
            min={1}
            max={10000}
            step={1}
            value={form.capacity}
            onChange={(event) =>
              onChange({ ...form, capacity: event.target.value })
            }
            className={`${inputClass} mt-2`}
          />
        </label>

        {mode === "edit" && (
          <label className="mt-4 block text-sm font-medium text-slate-700">
            Status
            <select
              value={form.status}
              onChange={(event) =>
                onChange({
                  ...form,
                  status:
                    event.target.value === "INACTIVE" ? "INACTIVE" : "ACTIVE",
                })
              }
              className={`${inputClass} mt-2`}
            >
              <option value="ACTIVE">Available</option>
              <option value="INACTIVE">Not Available</option>
            </select>
          </label>
        )}

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Facilities
          <textarea
            value={form.facilities}
            onChange={(event) =>
              onChange({ ...form, facilities: event.target.value })
            }
            maxLength={500}
            rows={2}
            className={`${inputClass} mt-2 resize-y`}
            placeholder="Wi-Fi, projector, air conditioning"
          />
          <span className="mt-1 block text-xs font-normal leading-5 text-slate-500">
            Optional. Shown on the resource details page. Separate items with commas.
          </span>
        </label>

        <label className="mt-4 block text-sm font-medium text-slate-700">
          Description
          <textarea
            value={form.description}
            onChange={(event) =>
              onChange({ ...form, description: event.target.value })
            }
            maxLength={1000}
            rows={3}
            className={`${inputClass} mt-2 resize-y`}
            placeholder="Optional details members should know"
          />
        </label>

        <div className="mt-4">
          <p className="text-sm font-medium text-slate-700">Photos</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Up to {MAX_RESOURCE_IMAGES} photos. These are saved with the
            resource and shown on the member dashboard.
          </p>
          {form.images.length > 0 && (
            <ul className="mt-3 grid grid-cols-2 gap-2">
              {form.images.map((photo, index) => (
                <li
                  key={`${index}-${photo.slice(0, 32)}`}
                  className="overflow-hidden rounded-xl border border-[#E2EAF3]"
                >
                  <img
                    src={photo}
                    alt=""
                    className="h-24 w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        ...form,
                        images: form.images.filter(
                          (_, photoIndex) => photoIndex !== index
                        ),
                      })
                    }
                    className="w-full px-2 py-1.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 hover:text-rose-600"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}
          <label className="mt-3 flex cursor-pointer items-center justify-center rounded-xl border border-dashed border-[#93C5FD] bg-[#F8FBFF] px-4 py-3 text-sm font-semibold text-[#2563EB] hover:bg-[#EFF6FF]">
            {readingPhotos
              ? "Reading photos..."
              : form.images.length >= MAX_RESOURCE_IMAGES
                ? "Photo limit reached"
                : "Add photos"}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              disabled={
                readingPhotos || form.images.length >= MAX_RESOURCE_IMAGES
              }
              className="sr-only"
              onChange={(event) => {
                void addPhotos(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          {photoError && (
            <p className="mt-2 text-sm text-rose-600">{photoError}</p>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E2EAF3] px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
          >
            {saving
              ? "Saving..."
              : mode === "edit"
                ? "Save changes"
                : "Add resource"}
          </button>
        </div>
      </form>
    </div>
  );
}

function categoryStyle(category: string) {
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

function CategoryGlyph({ category }: { category: string }) {
  if (category === "Meeting rooms" || category === "Other shared facilities") {
    return <BuildingIcon />;
  }

  if (
    category === "Shared desks and workspaces" ||
    category === "Shared equipment"
  ) {
    return <MonitorIcon />;
  }

  return <LayersIcon />;
}

function StatCard({
  label,
  value,
  change,
  caption,
  tone,
  alert = false,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  change: number;
  caption: string;
  tone: "blue" | "purple" | "green" | "orange";
  alert?: boolean;
  icon: ReactNode;
  onClick?: () => void;
}) {
  const tones = {
    blue: "bg-[#DBEAFE] text-[#1D4ED8]",
    purple: "bg-[#EDE9FE] text-[#6D28D9]",
    green: "bg-[#D1FAE5] text-[#047857]",
    orange: "bg-[#FFEDD5] text-[#C2410C]",
  };
  const trendTone = alert
    ? change > 0
      ? "text-[#C2410C]"
      : change < 0
        ? "text-emerald-600"
        : "text-slate-400"
    : change > 0
      ? "text-emerald-600"
      : change < 0
        ? "text-rose-600"
        : "text-slate-400";
  const arrow = change > 0 ? "↑" : change < 0 ? "↓" : "•";
  const signed = `${change > 0 ? "+" : ""}${change}%`;

  const card = (
    <>
      <div
        className={`flex h-10 w-10 items-center justify-center rounded-full ${tones[tone]}`}
      >
        {icon}
      </div>
      <p className="mt-3 text-sm text-slate-400">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tracking-tight text-slate-800">
        {value}
      </p>
      <p className="mt-2 text-xs leading-5">
        <span className={`font-semibold ${trendTone}`}>
          {arrow} {signed}
        </span>
        <span className="mt-0.5 block text-slate-400">{caption}</span>
      </p>
    </>
  );
  const cardClass =
    "rounded-2xl border border-[#E8EEF5] bg-white px-4 py-3.5 text-left shadow-[0_8px_24px_rgba(15,42,68,0.04)]";

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${cardClass} cursor-pointer hover:border-[#F5A524]`}>
        {card}
      </button>
    );
  }

  return <article className={cardClass}>{card}</article>;
}

function ReservationsPanel({
  reservations,
  visible,
  adminId,
  resources,
  search,
  status,
  resourceId,
  dateScope,
  sort,
  page,
  weekStart,
  weekEnd,
  reviewingId,
  deletingId,
  onSearch,
  onStatus,
  onResource,
  onDateScope,
  onSort,
  onPage,
  onShiftWeek,
  onReview,
  onDelete,
}: {
  reservations: AdminDashboardData["reservations"];
  visible: AdminDashboardData["reservations"];
  adminId: string;
  resources: AdminDashboardData["resources"];
  search: string;
  status: ReservationFilter;
  resourceId: string;
  dateScope: "all" | "week";
  sort: "newest" | "oldest" | "start";
  page: number;
  weekStart: Date;
  weekEnd: Date;
  reviewingId: string;
  deletingId: string;
  onSearch: (value: string) => void;
  onStatus: (value: ReservationFilter) => void;
  onResource: (value: string) => void;
  onDateScope: (value: "all" | "week") => void;
  onSort: (value: "newest" | "oldest" | "start") => void;
  onPage: (page: number) => void;
  onShiftWeek: (days: number) => void;
  onReview: (id: string, status: "CONFIRMED" | "CANCELLED") => void;
  onDelete: (
    reservation: AdminDashboardData["reservations"][number]
  ) => Promise<boolean>;
}) {
  const [viewId, setViewId] = useState<string | null>(null);
  const previousStart = addDays(weekStart, -7);
  const total = reservations.length;
  const pending = reservations.filter((item) => item.status === "PENDING").length;
  const confirmed = reservations.filter(
    (item) => item.status === "CONFIRMED"
  ).length;
  const cancelled = reservations.filter(
    (item) => item.status === "CANCELLED"
  ).length;
  const createdTrend = (nextStatus?: AdminDashboardData["reservations"][number]["status"]) =>
    percentChange(
      reservations.filter(
        (item) =>
          (nextStatus ? item.status === nextStatus : true) &&
          inRange(item.createdAt, weekStart, weekEnd)
      ).length,
      reservations.filter(
        (item) =>
          (nextStatus ? item.status === nextStatus : true) &&
          inRange(item.createdAt, previousStart, weekStart)
      ).length
    );
  const pageCount = Math.max(1, Math.ceil(visible.length / USER_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const startIndex = (currentPage - 1) * USER_PAGE_SIZE;
  const rows = visible.slice(startIndex, startIndex + USER_PAGE_SIZE);
  const showingFrom = visible.length === 0 ? 0 : startIndex + 1;
  const showingTo = Math.min(startIndex + rows.length, visible.length);
  const pages = pageList(currentPage, pageCount);
  const filterClass =
    "h-11 rounded-xl border border-[#E2EAF3] bg-white px-3 text-sm text-slate-600 outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]";
  const viewed = reservations.find((item) => item.id === viewId);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid shrink-0 grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <UserMetric
          label="Total Reservations"
          value={total}
          icon={<CalendarIcon />}
          iconClass="bg-[#E8F2FF] text-[#3B82F6]"
          change={createdTrend()}
          caption="from last week"
        />
        <UserMetric
          label="Pending Approval"
          value={pending}
          icon={<ClockIcon />}
          iconClass="bg-[#FFF4E5] text-[#F5A524]"
          change={createdTrend("PENDING")}
          caption="awaiting approval"
          alert
        />
        <UserMetric
          label="Confirmed"
          value={confirmed}
          icon={<CheckIcon />}
          iconClass="bg-[#E8F8EF] text-[#22A06B]"
          change={createdTrend("CONFIRMED")}
          caption="this week"
        />
        <UserMetric
          label="Cancelled"
          value={cancelled}
          icon={<CancelIcon />}
          iconClass="bg-[#FEE2E2] text-[#E11D48]"
          change={createdTrend("CANCELLED")}
          caption="this week"
          alert
        />
      </div>

      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
            <SearchIcon />
          </span>
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search by user, resource, or ID..."
            className="h-11 w-full rounded-xl border border-[#E2EAF3] bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
          />
        </div>
        <div className="flex h-11 items-center rounded-xl border border-[#E2EAF3] bg-white px-1 text-sm text-slate-600">
          <button
            type="button"
            aria-label="Previous week"
            onClick={() => {
              onShiftWeek(-7);
              onDateScope("week");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
          >
            <ChevronLeftIcon />
          </button>
          <button
            type="button"
            onClick={() => onDateScope(dateScope === "week" ? "all" : "week")}
            className="flex items-center gap-2 px-2"
          >
            <CalendarIcon />
            {dateScope === "all"
              ? "All dates"
              : `${formatDay(weekStart)} – ${formatDay(addDays(weekEnd, -1))}`}
          </button>
          <button
            type="button"
            aria-label="Next week"
            onClick={() => {
              onShiftWeek(7);
              onDateScope("week");
            }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-50"
          >
            <ChevronRightIcon />
          </button>
        </div>
        <select
          value={resourceId}
          onChange={(event) => onResource(event.target.value)}
          className={filterClass}
        >
          <option value="all">All Resources</option>
          {resources.map((resource) => (
            <option key={resource.id} value={resource.id}>
              {resource.name}
            </option>
          ))}
        </select>
        <select
          value={status}
          onChange={(event) => {
            const value = event.target.value;
            onStatus(
              value === "PENDING" || value === "CONFIRMED" || value === "CANCELLED"
                ? value
                : "all"
            );
          }}
          className={filterClass}
        >
          <option value="all">All Statuses</option>
          <option value="PENDING">Pending</option>
          <option value="CONFIRMED">Confirmed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
        <label className="flex h-11 items-center gap-2 rounded-xl border border-[#E2EAF3] bg-white px-3 text-sm text-slate-500">
          Sort by
          <select
            value={sort}
            onChange={(event) => {
              const value = event.target.value;
              onSort(
                value === "oldest" || value === "start" ? value : "newest"
              );
            }}
            className="bg-transparent font-medium text-slate-700 outline-none"
          >
            <option value="newest">Date (Newest)</option>
            <option value="oldest">Date (Oldest)</option>
            <option value="start">Booking time</option>
          </select>
        </label>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white shadow-[0_8px_24px_rgba(15,42,68,0.04)]">
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-[#F1F5F9] text-xs text-slate-400">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-2 py-3 font-medium">User</th>
                <th className="px-2 py-3 font-medium">Resource</th>
                <th className="px-2 py-3 font-medium">Date & Time</th>
                <th className="px-2 py-3 font-medium">Duration</th>
                <th className="px-2 py-3 font-medium">Status</th>
                <th className="px-2 py-3 font-medium">Requested On</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-slate-400">
                    No reservations match these filters.
                  </td>
                </tr>
              ) : (
                rows.map((reservation, index) => {
                  const slot = formatSlot(
                    reservation.startTime,
                    reservation.endTime
                  );
                  const requested = formatSlot(
                    reservation.createdAt,
                    reservation.createdAt
                  );
                  const category = categoryLabel(reservation.resourceCategory);
                  const canChange = reservation.timing !== "past";

                  return (
                    <tr
                      key={reservation.id}
                      className="border-b border-[#F8FAFC]"
                    >
                      <td className="px-4 py-3 text-slate-400">
                        {startIndex + index + 1}
                      </td>
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${avatarTone(reservation.userEmail)}`}
                          >
                            {initials(reservation.userName)}
                          </span>
                          <span>
                            <span className="block font-semibold text-slate-700">
                              {reservation.userName}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {reservation.userEmail}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-3">
                        <span className="flex items-center gap-3">
                          <span
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${categoryStyle(category)}`}
                          >
                            <CategoryGlyph category={category} />
                          </span>
                          <span>
                            <span className="block font-medium text-slate-700">
                              {reservation.resourceName}
                            </span>
                            <span className="block text-xs text-slate-400">
                              {reservation.resourceLocation}
                            </span>
                          </span>
                        </span>
                      </td>
                      <td className="px-2 py-3 text-slate-600">
                        <span className="block">{slot.day}</span>
                        <span className="block text-xs text-slate-400">
                          {slot.time}
                        </span>
                      </td>
                      <td className="px-2 py-3 text-slate-500">
                        {formatDuration(
                          reservation.startTime,
                          reservation.endTime
                        )}
                      </td>
                      <td className="px-2 py-3">
                        <ReservationStatus status={reservation.status} />
                      </td>
                      <td className="px-2 py-3 text-slate-500">
                        <span className="block">{requested.day}</span>
                        <span className="block text-xs text-slate-400">
                          {requested.time}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex justify-end gap-2">
                          <IconAction
                            label={`View ${reservation.title}`}
                            onClick={() => setViewId(reservation.id)}
                          >
                            <EyeIcon />
                          </IconAction>
                          {reservation.status === "PENDING" && canChange && (
                            <IconAction
                              label={`Approve ${reservation.title}`}
                              tone="success"
                              disabled={
                                reviewingId === reservation.id ||
                                deletingId === reservation.id
                              }
                              onClick={() =>
                                onReview(reservation.id, "CONFIRMED")
                              }
                            >
                              <CheckIcon />
                            </IconAction>
                          )}
                          {reservation.status === "CONFIRMED" &&
                            canChange &&
                            !isUserConfirmedBooking(reservation, adminId) && (
                            <IconAction
                              label={`Cancel ${reservation.title}`}
                              tone="danger"
                              disabled={
                                reviewingId === reservation.id ||
                                deletingId === reservation.id
                              }
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Cancel ${reservation.title}?`
                                  )
                                ) {
                                  onReview(reservation.id, "CANCELLED");
                                }
                              }}
                            >
                              <CancelIcon />
                            </IconAction>
                          )}
                          {reservation.status === "PENDING" && canChange && (
                            <IconAction
                              label={`Decline ${reservation.title}`}
                              tone="danger"
                              disabled={
                                reviewingId === reservation.id ||
                                deletingId === reservation.id
                              }
                              onClick={() =>
                                onReview(reservation.id, "CANCELLED")
                              }
                            >
                              <CancelIcon />
                            </IconAction>
                          )}
                          {!isUserConfirmedBooking(reservation, adminId) && (
                            <IconAction
                              label={`Delete ${reservation.title}`}
                              tone="danger"
                              disabled={
                                reviewingId === reservation.id ||
                                deletingId === reservation.id
                              }
                              onClick={() => void onDelete(reservation)}
                            >
                              <TrashIcon />
                            </IconAction>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#F1F5F9] px-4 py-3">
          <p className="text-sm text-slate-400">
            Showing {showingFrom} to {showingTo} of {visible.length} reservations
          </p>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="Previous page"
              disabled={currentPage <= 1}
              onClick={() => onPage(currentPage - 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 disabled:opacity-40"
            >
              <ChevronLeftIcon />
            </button>
            {pages.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onPage(item)}
                className={`flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold ${
                  item === currentPage
                    ? "bg-[#3B82F6] text-white"
                    : "border border-[#E6EEF5] text-slate-500"
                }`}
              >
                {item}
              </button>
            ))}
            <button
              type="button"
              aria-label="Next page"
              disabled={currentPage >= pageCount}
              onClick={() => onPage(currentPage + 1)}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#E6EEF5] text-slate-400 disabled:opacity-40"
            >
              <ChevronRightIcon />
            </button>
          </div>
        </div>
      </div>

      {viewed && (
        <BookingDetailsDialog
          reservation={viewed}
          adminId={adminId}
          reviewingId={reviewingId}
          deletingId={deletingId}
          onClose={() => setViewId(null)}
          onReview={onReview}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}

function ReservationStatus({
  status,
}: {
  status: AdminDashboardData["reservations"][number]["status"];
}) {
  const styles = {
    PENDING: "bg-[#FFF4E0] text-[#D97706]",
    CONFIRMED: "bg-[#E8F8EF] text-[#178A52]",
    CANCELLED: "bg-[#FEE2E2] text-[#E11D48]",
  };
  const labels = {
    PENDING: "Pending",
    CONFIRMED: "Confirmed",
    CANCELLED: "Cancelled",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${styles[status]}`}
    >
      {labels[status]}
    </span>
  );
}

function IconAction({
  label,
  onClick,
  disabled,
  tone = "neutral",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  tone?: "neutral" | "success" | "danger";
  children: ReactNode;
}) {
  const tones = {
    neutral:
      "border-[#E6EEF5] text-slate-400 hover:bg-[#F5F9FC] hover:text-[#3B82F6]",
    success:
      "border-[#BBF7D0] text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600",
    danger: "border-[#FECACA] text-rose-400 hover:bg-rose-50 hover:text-rose-600",
  };

  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-lg border disabled:opacity-60 ${tones[tone]}`}
    >
      {children}
    </button>
  );
}

function formatSlot(startIso: string, endIso: string) {
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

function formatDuration(startIso: string, endIso: string) {
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

function PendingRequests({
  requests,
  adminId,
  search,
  reviewingId,
  deletingId,
  onSearch,
  onReview,
  onDelete,
}: {
  requests: AdminDashboardData["reservations"];
  adminId: string;
  search: string;
  reviewingId: string;
  deletingId: string;
  onSearch: (value: string) => void;
  onReview: (id: string, status: "CONFIRMED" | "CANCELLED") => void;
  onDelete: (
    reservation: AdminDashboardData["reservations"][number]
  ) => Promise<boolean>;
}) {
  const [viewId, setViewId] = useState<string | null>(null);
  const term = search.trim().toLowerCase();
  const rows = requests
    .filter((reservation) => {
      if (!term) {
        return true;
      }

      return (
        reservation.title.toLowerCase().includes(term) ||
        (reservation.purpose ?? "").toLowerCase().includes(term) ||
        reservation.userName.toLowerCase().includes(term) ||
        reservation.userEmail.toLowerCase().includes(term) ||
        reservation.resourceName.toLowerCase().includes(term) ||
        reservation.participants.some(
          (person) =>
            person.name.toLowerCase().includes(term) ||
            person.email.toLowerCase().includes(term)
        )
      );
    })
    .sort(
      (a, b) =>
        new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
  const viewed = requests.find((reservation) => reservation.id === viewId);

  return (
    <section className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="relative shrink-0">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
          <SearchIcon />
        </span>
        <input
          value={search}
          onChange={(event) => onSearch(event.target.value)}
          placeholder="Search by person, resource, or title..."
          className="h-11 w-full rounded-xl border border-[#E2EAF3] bg-white pl-10 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[#E8EEF5] bg-white shadow-[0_8px_24px_rgba(15,42,68,0.04)]">
        {rows.length === 0 ? (
          <EmptyState
            title="No pending requests"
            detail="New booking requests will show up here for approval."
          />
        ) : (
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-[#F1F5F9] text-xs text-slate-400">
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-2 py-3 font-medium">Resource</th>
                  <th className="px-2 py-3 font-medium">Date & Time</th>
                  <th className="px-2 py-3 font-medium">Purpose</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((reservation) => (
                  <tr
                    key={reservation.id}
                    className="border-b border-[#F8FAFC]"
                  >
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-700">
                        {reservation.userName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {reservation.userEmail}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-slate-600">
                      <p>{reservation.resourceName}</p>
                      <p className="text-xs text-slate-400">
                        {reservation.resourceLocation}
                      </p>
                    </td>
                    <td className="px-2 py-3 text-slate-500">
                      {formatRange(reservation.startTime, reservation.endTime)}
                    </td>
                    <td className="max-w-56 px-2 py-3 text-slate-500">
                      {reservation.purpose || reservation.title}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setViewId(reservation.id)}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          Details
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === reservation.id}
                          onClick={() => onReview(reservation.id, "CONFIRMED")}
                          className="rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
                        >
                          {reviewingId === reservation.id
                            ? "Saving..."
                            : "Approve"}
                        </button>
                        <button
                          type="button"
                          disabled={reviewingId === reservation.id}
                          onClick={() => onReview(reservation.id, "CANCELLED")}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
                        >
                          Decline
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      {viewed && (
        <BookingDetailsDialog
          reservation={viewed}
          adminId={adminId}
          reviewingId={reviewingId}
          deletingId={deletingId}
          onClose={() => setViewId(null)}
          onReview={onReview}
          onDelete={onDelete}
        />
      )}
    </section>
  );
}

function BookingDetailsDialog({
  reservation,
  adminId,
  reviewingId,
  deletingId,
  onClose,
  onReview,
  onDelete,
}: {
  reservation: AdminDashboardData["reservations"][number];
  adminId: string;
  reviewingId: string;
  deletingId: string;
  onClose: () => void;
  onReview: (id: string, status: "CONFIRMED" | "CANCELLED") => void;
  onDelete: (
    reservation: AdminDashboardData["reservations"][number]
  ) => Promise<boolean>;
}) {
  const category = categoryLabel(reservation.resourceCategory);
  const subcategory = subcategoryLabel(reservation.resourceSubcategory);
  const requested = formatSlot(reservation.createdAt, reservation.createdAt);
  const updated = formatSlot(reservation.updatedAt, reservation.updatedAt);
  const canChange = reservation.timing !== "past";
  const locked = isUserConfirmedBooking(reservation, adminId);
  const reviewing = reviewingId === reservation.id;
  const deleting = deletingId === reservation.id;
  const busy = reviewing || deleting;
  const partySize = 1 + reservation.participants.length;
  const timingLabel = {
    upcoming: "Upcoming",
    in_progress: "In progress",
    past: "Ended",
  }[reservation.timing];

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-details-title"
        className="flex max-h-[min(90vh,760px)] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-[#F1F5F9] px-6 py-5">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              Booking details
            </p>
            <h2
              id="booking-details-title"
              className="mt-1 text-lg font-bold text-slate-800"
            >
              {reservation.title}
            </h2>
            <p className="mt-1 text-sm text-slate-400">{timingLabel}</p>
          </div>
          <ReservationStatus status={reservation.status} />
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
            <DetailField label="Booked by" value={reservation.userName}>
              {reservation.userEmail}
            </DetailField>
            <DetailField
              label="Position"
              value={jobPositionLabel(reservation.userJobPosition)}
            />
            <DetailField label="Resource" value={reservation.resourceName}>
              {category} · {subcategory}
            </DetailField>
            <DetailField label="Location" value={reservation.resourceLocation} />
            <DetailField
              label="When"
              value={formatRange(reservation.startTime, reservation.endTime)}
            />
            <DetailField
              label="Duration"
              value={formatDuration(reservation.startTime, reservation.endTime)}
            />
            <DetailField
              label="People"
              value={`${partySize} of ${reservation.resourceCapacity}`}
            >
              Including the person who booked
            </DetailField>
            <DetailField label="Requested" value={requested.day}>
              {requested.time}
            </DetailField>
            <DetailField label="Last updated" value={updated.day}>
              {updated.time}
            </DetailField>
          </dl>
          <div className="mt-5">
            <p className="text-xs font-medium text-slate-400">Purpose</p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {reservation.purpose?.trim() || "No purpose was entered."}
            </p>
          </div>
          {(reservation.resourceFacilities?.trim() ||
            reservation.resourceDescription?.trim()) && (
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {reservation.resourceFacilities?.trim() && (
                <div>
                  <p className="text-xs font-medium text-slate-400">Facilities</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {reservation.resourceFacilities.trim()}
                  </p>
                </div>
              )}
              {reservation.resourceDescription?.trim() && (
                <div>
                  <p className="text-xs font-medium text-slate-400">
                    Resource description
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {reservation.resourceDescription.trim()}
                  </p>
                </div>
              )}
            </div>
          )}
          <div className="mt-5">
            <p className="text-xs font-medium text-slate-400">
              People on this booking
            </p>
            <ul className="mt-2 divide-y divide-[#F1F5F9] rounded-xl border border-[#E8EEF5]">
              <li className="px-3 py-2.5">
                <p className="text-sm font-semibold text-slate-700">
                  {reservation.userName}
                </p>
                <p className="text-xs text-slate-400">
                  {reservation.userEmail} · Booked this resource
                </p>
              </li>
              {reservation.participants.map((person) => (
                <li key={`${person.email}-${person.name}`} className="px-3 py-2.5">
                  <p className="text-sm font-semibold text-slate-700">
                    {person.name}
                  </p>
                  <p className="text-xs text-slate-400">{person.email}</p>
                </li>
              ))}
            </ul>
            {reservation.participants.length === 0 && (
              <p className="mt-2 text-sm text-slate-500">
                No other people were added.
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-[#F1F5F9] px-6 py-4">
          {!locked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void onDelete(reservation).then((removed) => {
                  if (removed) {
                    onClose();
                  }
                });
              }}
              className="mr-auto rounded-xl border border-[#FECACA] px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              {deleting ? "Deleting..." : "Delete"}
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#E2EAF3] px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Close
          </button>
          {reservation.status === "CONFIRMED" && canChange && !locked && (
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm(`Cancel ${reservation.title}?`)) {
                  onReview(reservation.id, "CANCELLED");
                }
              }}
              className="rounded-xl border border-[#FECACA] px-4 py-2.5 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
            >
              {reviewing ? "Saving..." : "Cancel booking"}
            </button>
          )}
          {reservation.status === "PENDING" && canChange && (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={() => onReview(reservation.id, "CANCELLED")}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                {reviewing ? "Saving..." : "Decline"}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onReview(reservation.id, "CONFIRMED")}
                className="rounded-xl bg-[#3B82F6] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#2563EB] disabled:opacity-60"
              >
                {reviewing ? "Saving..." : "Approve"}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DetailField({
  label,
  value,
  children,
}: {
  label: string;
  value: string;
  children?: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-slate-400">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-slate-700">{value}</dd>
      {children && <dd className="text-xs text-slate-400">{children}</dd>}
    </div>
  );
}

function WeekBars({ days }: { days: { label: string; value: number }[] }) {
  const max = axisMax(Math.max(0, ...days.map((day) => day.value)));
  const ticks = [4, 3, 2, 1, 0].map((step) => Math.round((max * step) / 4));

  return (
    <div className="mt-3 flex min-h-0 flex-1 overflow-hidden">
      <div className="flex h-full min-h-[140px] w-full min-w-[320px] gap-3">
        <div className="flex h-[calc(100%-1.25rem)] flex-col justify-between text-[11px] text-slate-400">
          {ticks.map((tick, index) => (
            <span key={index}>{tick}</span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="absolute inset-x-0 top-0 bottom-5">
            <div className="flex h-full flex-col justify-between">
              {ticks.map((tick, index) => (
                <div key={index} className="border-t border-[#EEF3F8]" />
              ))}
            </div>
            <div className="absolute inset-0 flex items-end justify-between gap-3 px-1">
              {days.map((day) => (
                <div
                  key={day.label}
                  className="flex h-full flex-1 items-end justify-center"
                >
                  <div
                    className="w-full max-w-10 rounded-t-lg bg-[#2563EB]"
                    style={{
                      height: day.value === 0 ? 0 : `${(day.value / max) * 100}%`,
                      minHeight: day.value > 0 ? 6 : 0,
                    }}
                    title={`${day.label}: ${day.value}`}
                  />
                </div>
              ))}
            </div>
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-between gap-3 px-1">
            {days.map((day) => (
              <span
                key={day.label}
                className="flex-1 truncate text-center text-[11px] text-slate-400"
              >
                {day.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsageDonut({
  slices,
  total,
}: {
  slices: { label: string; value: number; color: string }[];
  total: number;
}) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  let cursor = 0;

  return (
    <div className="mt-2 flex min-h-0 flex-1 items-center justify-center gap-4 overflow-hidden">
      <svg viewBox="0 0 160 160" className="h-full max-h-40 w-auto" aria-hidden="true">
        <g transform="rotate(-90 80 80)">
          <circle
            cx="80"
            cy="80"
            r={radius}
            fill="none"
            className="chart-track"
            stroke="#EEF3F8"
            strokeWidth="18"
          />
          {total > 0 &&
            slices.map((slice) => {
              const fraction = slice.value / total;
              const gap = slices.length > 1 ? circumference * 0.015 : 0;
              const length = Math.max(fraction * circumference - gap, 0);
              const dashOffset = -cursor;
              cursor += fraction * circumference;

              return (
                <circle
                  key={slice.label}
                  cx="80"
                  cy="80"
                  r={radius}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth="18"
                  strokeDasharray={`${length} ${circumference - length}`}
                  strokeDashoffset={dashOffset}
                />
              );
            })}
        </g>
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="chart-total"
          fill="#1e293b"
          fontSize="22"
          fontWeight="700"
        >
          {total}
        </text>
        <text
          x="80"
          y="96"
          textAnchor="middle"
          className="chart-caption"
          fill="#94a3b8"
          fontSize="11"
        >
          Resources
        </text>
      </svg>
      {slices.length === 0 ? (
        <p className="text-sm text-slate-400">No resources yet.</p>
      ) : (
        <ul className="min-w-40 space-y-3">
          {slices.map((slice) => (
            <li
              key={slice.label}
              className="flex items-center gap-2 text-sm text-slate-500"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: slice.color }}
              />
              <span className="flex-1">{slice.label}</span>
              <span className="font-semibold text-slate-700">{slice.value}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ActivityTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => formatShort(iso));

  useEffect(() => {
    setLabel(relativeTime(iso));
  }, [iso]);

  return <span className="shrink-0 text-xs text-slate-400">{label}</span>;
}

function ActivityList({
  items,
  onOpen,
}: {
  items: ActivityItem[];
  onOpen: (kind: ActivityKind) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        title="No activity yet"
        detail="New users, resources, and reservations will appear here."
      />
    );
  }

  return (
    <ul className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto">
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            onClick={() => onOpen(item.kind)}
            className="flex w-full items-start gap-3 text-left"
          >
            <span
              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${activityDot(item.kind)}`}
            />
            <span className={`mt-0.5 ${activityIconColor(item.kind)}`}>
              <ActivityGlyph kind={item.kind} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold text-slate-700">
                {item.title}
              </span>
              <span className="mt-0.5 block truncate text-xs text-slate-400">
                {item.detail}
              </span>
            </span>
            <ActivityTime iso={item.at} />
          </button>
        </li>
      ))}
    </ul>
  );
}

function Badge({
  children,
  tone,
}: {
  children: string;
  tone: "info" | "success" | "muted" | "warning" | "progress";
}) {
  const tones = {
    info: "bg-[#E8F2FF] text-[#2F7CF6]",
    success: "bg-[#E8F8EF] text-[#178A52]",
    muted: "bg-slate-100 text-slate-500",
    warning: "bg-[#FFF4E0] text-[#D97706]",
    progress: "bg-[#E0F7FA] text-[#0E7490]",
  };

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function ReportDownload({
  title,
  detail,
  onDownload,
}: {
  title: string;
  detail: string;
  onDownload: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onDownload}
      className="flex items-center justify-between gap-3 rounded-xl border border-[#E2EAF3] bg-[#F8FBFF] px-4 py-3 text-left transition hover:border-[#BFDBFE] hover:bg-[#EFF6FF]"
    >
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-slate-700">
          {title}
        </span>
        <span className="mt-0.5 block text-xs text-slate-400">{detail}</span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5 text-sm font-semibold text-[#2F7CF6]">
        <DownloadIcon />
        CSV
      </span>
    </button>
  );
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-[#E2EAF3] px-4 py-8 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function SectionIcon({ id }: { id: Section }) {
  if (id === "dashboard") return <HomeIcon />;
  if (id === "users") return <UsersIcon />;
  if (id === "resources") return <LayersIcon />;
  if (id === "reservations") return <CalendarIcon />;
  if (id === "pending") return <ClockIcon />;
  if (id === "reports") return <ChartIcon />;
  if (id === "notifications") return <BellIcon />;
  return <UserIcon />;
}

function ActivityGlyph({ kind }: { kind: ActivityKind }) {
  if (kind === "reservation") return <CalendarIcon />;
  if (kind === "resource") return <PencilIcon />;
  if (kind === "user") return <UserIcon />;
  return <CancelIcon />;
}

function IconFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

function HomeIcon() {
  return (
    <IconFrame>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </IconFrame>
  );
}

function UsersIcon() {
  return (
    <IconFrame>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a3 3 0 0 1 0 5.75" />
    </IconFrame>
  );
}

function LayersIcon() {
  return (
    <IconFrame>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </IconFrame>
  );
}

function CalendarIcon() {
  return (
    <IconFrame>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </IconFrame>
  );
}

function ChartIcon() {
  return (
    <IconFrame>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </IconFrame>
  );
}

function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

function BellIcon() {
  return (
    <IconFrame>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </IconFrame>
  );
}

function UserIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </IconFrame>
  );
}

function ClockIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </IconFrame>
  );
}

function SearchIcon() {
  return (
    <IconFrame>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconFrame>
  );
}

function DonutIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </IconFrame>
  );
}

function PencilIcon() {
  return (
    <IconFrame>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
    </IconFrame>
  );
}

function PlusIcon() {
  return (
    <IconFrame>
      <path d="M12 5v14M5 12h14" />
    </IconFrame>
  );
}

function ShieldIcon() {
  return (
    <IconFrame>
      <path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6z" />
    </IconFrame>
  );
}

function EyeIcon() {
  return (
    <IconFrame>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </IconFrame>
  );
}

function BuildingIcon() {
  return (
    <IconFrame>
      <path d="M4 20V6l8-3 8 3v14" />
      <path d="M9 20v-5h6v5" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </IconFrame>
  );
}

function MonitorIcon() {
  return (
    <IconFrame>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </IconFrame>
  );
}

function TrashIcon() {
  return (
    <IconFrame>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l1 12h6l1-12" />
    </IconFrame>
  );
}

function CheckIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.3 2.3 4.7-5" />
    </IconFrame>
  );
}

function CancelIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="8" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </IconFrame>
  );
}

function MenuIcon() {
  return (
    <IconFrame>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconFrame>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true">
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 5 7 10l5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path
        d="m8 5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CampusArt() {
  return (
    <svg viewBox="0 0 160 78" className="mx-auto h-16 w-32" aria-hidden="true">
      <ellipse cx="80" cy="70" rx="58" ry="6" fill="#E7F6EA" />
      <rect x="52" y="36" width="56" height="30" rx="3" fill="#D7EBFF" />
      <path d="M46 38 80 16l34 22" fill="#7EB6FF" />
      <rect x="74" y="48" width="12" height="18" rx="1.5" fill="#5B9DFF" />
      <rect x="58" y="44" width="9" height="7" rx="1" fill="#fff" />
      <rect x="93" y="44" width="9" height="7" rx="1" fill="#fff" />
      <circle cx="28" cy="52" r="9" fill="#86EFAC" />
      <rect x="26" y="52" width="4" height="16" rx="1" fill="#94A978" />
      <circle cx="132" cy="54" r="8" fill="#4ADE80" />
      <rect x="130" y="54" width="4" height="14" rx="1" fill="#94A978" />
    </svg>
  );
}

function reservationStatus(
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

function buildWeekDays(
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

function buildUsage(resources: AdminDashboardData["resources"]) {
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

function buildActivity(data: AdminDashboardData): ActivityItem[] {
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

function activityDot(kind: ActivityKind) {
  if (kind === "reservation") return "bg-emerald-600";
  if (kind === "resource") return "bg-[#D97706]";
  if (kind === "user") return "bg-[#2563EB]";
  return "bg-rose-600";
}

function activityIconColor(kind: ActivityKind) {
  if (kind === "reservation") return "text-emerald-600";
  if (kind === "resource") return "text-[#D97706]";
  if (kind === "user") return "text-[#2563EB]";
  return "text-rose-600";
}

function percentChange(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function inRange(iso: string, start: Date, end: Date) {
  const time = new Date(iso).getTime();
  return time >= start.getTime() && time < end.getTime();
}

function startOfMonth(anchor: Date) {
  return new Date(anchor.getFullYear(), anchor.getMonth(), 1);
}

function shareOf(count: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Math.round((count / total) * 100);
}

function pageList(current: number, count: number) {
  if (count <= 5) {
    return Array.from({ length: count }, (_, index) => index + 1);
  }

  const start = Math.max(1, Math.min(current - 2, count - 4));
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function avatarTone(id: string) {
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

function formatJoined(iso: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
}

function startOfWeek(anchor: Date) {
  const start = new Date(anchor);
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  return start;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function axisMax(value: number) {
  if (value <= 0) {
    return 4;
  }

  return Math.max(4, Math.ceil(value / 4) * 4);
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase());
  return letters.join("") || "A";
}

function formatDay(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(date);
}

function formatShort(iso: string) {
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

function relativeTime(iso: string) {
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

function downloadUsersReport(users: AdminDashboardData["users"]) {
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

function downloadReservationsReport(
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

function downloadResourcesReport(resources: AdminDashboardData["resources"]) {
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

function reservationStatusLabel(
  status: AdminDashboardData["reservations"][number]["status"]
) {
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "PENDING") return "Pending";
  return "Cancelled";
}

function downloadCsv(filename: string, headers: string[], rows: string[][]) {
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

function csvCell(value: string) {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  return value;
}

function reportStamp() {
  const date = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatReportDate(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const pad = (value: number) => String(value).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
