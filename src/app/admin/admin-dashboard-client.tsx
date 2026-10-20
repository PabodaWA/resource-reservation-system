"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocalStorageValue, setLocalStorageValue } from "@/lib/use-local-storage-value";
import ThemeToggle from "@/components/theme-toggle";
import { MEMBER_JOB_POSITIONS, isJobPosition, jobPositionLabel } from "@/lib/job-position";
import { categoryLabel, parseResourceClassification, subcategoryBelongsToCategory, subcategoryLabel } from "@/lib/resource-catalog";
import { MAX_RESOURCE_IMAGES } from "@/lib/resource-images";
import { isResourceLocation } from "@/lib/resource-locations";
import { ActivityList, Badge, EmptyState, ReportDownload, StatCard, UsageDonut, WeekBars } from "@/components/admin/widgets";
import { BellIcon, CalendarIcon, CampusArt, ChartIcon, ChevronIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, DonutIcon, LayersIcon, MenuIcon, PlusIcon, SearchIcon, SectionIcon, UsersIcon } from "@/components/admin/icons";
import { PendingRequests, ReservationsPanel } from "@/components/admin/reservations-panel";
import { ResourceDialog, ResourcesPanel } from "@/components/admin/resources-panel";
import { UsersPanel } from "@/components/admin/users-panel";
import { addDays, buildActivity, buildUsage, buildWeekDays, downloadReservationsReport, downloadResourcesReport, downloadUsersReport, emailAlreadyUsed, emptyResource, emptyUser, formatDay, formatShort, inRange, initials, inputClass, isAccountLocked, isUserConfirmedBooking, percentChange, reservationStatus, sectionCopy, sections, startOfWeek, type AdminDashboardData, type ReservationFilter, type SearchHit, type Section } from "@/components/admin/model";

export type { AdminDashboardData } from "@/components/admin/model";

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
  const [pendingSort, setPendingSort] = useState<
    "start" | "newest" | "oldest" | "requester" | "resource"
  >("start");
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
  const clearedNoticeAt = Number(
    useLocalStorageValue(`resourcehub-notices:${data.admin.id}:cleared`, "0")
  ) || 0;
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
  const currentTime = new Date().getTime();
  const notificationCount = notifications.filter(
    (item) => currentTime - new Date(item.at).getTime() < 7 * 24 * 60 * 60 * 1000
  ).length;

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
            Math.abs(new Date(a.startTime).getTime() - currentTime) -
            Math.abs(new Date(b.startTime).getTime() - currentTime)
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

  const managedReservations = (() => {
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
  })();

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
    setLocalStorageValue(`${noticeKey}:cleared`, String(clearedAt));
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
    status: "CONFIRMED" | "CANCELLED",
    declineReason?: string
  ) {
    setError("");
    setSuccess("");
    setReviewingId(reservationId);

    try {
      const response = await fetch(`/api/reservations/${reservationId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, declineReason }),
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

    const permanentlyDelete = !user.isActive;
    const confirmed = window.confirm(
      permanentlyDelete
        ? `Permanently delete ${user.name}? This cannot be undone. Users with existing reservations cannot be deleted.`
        : `Deactivate ${user.name}? They will not be able to sign in until an administrator activates the account again. Existing reservations stay in place.`
    );

    if (!confirmed) {
      return;
    }

    setDeletingUserId(user.id);

    try {
      const response = await fetch(
        `/api/users/${user.id}${permanentlyDelete ? "?permanent=true" : ""}`,
        {
        method: "DELETE",
        }
      );

      const payload: { message?: string } = await response.json();

      if (!response.ok) {
        throw new Error(payload.message || "Unable to deactivate this account.");
      }

      setSuccess(
        permanentlyDelete
          ? `${user.name} was permanently deleted.`
          : `${user.name} is now inactive.`
      );
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
      setError("Choose a location from the list.");
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
      setError("Choose a location from the list.");
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
                sort={pendingSort}
                onSort={setPendingSort}
                onReview={(id, status, declineReason) =>
                  void handleReview(id, status, declineReason)
                }
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
                onReview={(id, status, declineReason) =>
                  void handleReview(id, status, declineReason)
                }
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
