"use client";

import { useEffect, useState } from "react";
import { jobPositionLabel } from "@/lib/job-position";
import { categoryLabel, subcategoryLabel } from "@/lib/resource-catalog";
import { CalendarIcon, CancelIcon, CategoryGlyph, CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, EyeIcon, SearchIcon, TrashIcon } from "./icons";
import { DetailField, EmptyState, IconAction, ReservationStatus, UserMetric } from "./widgets";
import { USER_PAGE_SIZE, addDays, avatarTone, categoryStyle, formatDay, formatDuration, formatRange, formatSlot, inRange, initials, isUserConfirmedBooking, pageList, percentChange, type AdminDashboardData, type ReservationFilter } from "./model";

export function ReservationsPanel({
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
  onReview: (
    id: string,
    status: "CONFIRMED" | "CANCELLED",
    declineReason?: string
  ) => void;
  onDelete: (
    reservation: AdminDashboardData["reservations"][number]
  ) => Promise<boolean>;
}) {
  const [viewId, setViewId] = useState<string | null>(null);
  const [declineReservation, setDeclineReservation] = useState<AdminDashboardData["reservations"][number] | null>(null);
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
                              onClick={() => setDeclineReservation(reservation)}
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
      {declineReservation && (
        <DeclineReasonDialog
          reservation={declineReservation}
          busy={reviewingId === declineReservation.id}
          onClose={() => setDeclineReservation(null)}
          onSubmit={(reason) => {
            onReview(declineReservation.id, "CANCELLED", reason);
            setDeclineReservation(null);
          }}
        />
      )}
    </section>
  );
}

export function PendingRequests({
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
  onReview: (
    id: string,
    status: "CONFIRMED" | "CANCELLED",
    declineReason?: string
  ) => void;
  onDelete: (
    reservation: AdminDashboardData["reservations"][number]
  ) => Promise<boolean>;
}) {
  const [viewId, setViewId] = useState<string | null>(null);
  const [declineReservation, setDeclineReservation] = useState<AdminDashboardData["reservations"][number] | null>(null);
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
            <table className="w-full min-w-[860px] text-left text-sm">
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
                          onClick={() => setDeclineReservation(reservation)}
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
      {declineReservation && (
        <DeclineReasonDialog
          reservation={declineReservation}
          busy={reviewingId === declineReservation.id}
          onClose={() => setDeclineReservation(null)}
          onSubmit={(reason) => {
            onReview(declineReservation.id, "CANCELLED", reason);
            setDeclineReservation(null);
          }}
        />
      )}
    </section>
  );
}

function DeclineReasonDialog({
  reservation,
  busy,
  onClose,
  onSubmit,
}: {
  reservation: AdminDashboardData["reservations"][number];
  busy: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => void;
}) {
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="decline-reason-title"
        onSubmit={(event) => { event.preventDefault(); if (trimmedReason && reason.length <= 500 && !busy) onSubmit(trimmedReason); }}
        className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl"
      >
        <h2 id="decline-reason-title" className="text-lg font-bold text-slate-800">Decline request</h2>
        <p className="mt-1 text-sm text-slate-500">Add a reason for declining “{reservation.title}”. The requester will receive it by email.</p>
        <label htmlFor="decline-reason" className="mt-5 block text-sm font-semibold text-slate-700">Reason <span className="text-rose-600">*</span></label>
        <textarea
          id="decline-reason"
          required
          autoFocus
          maxLength={500}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={4}
          placeholder="Explain why this request is being declined..."
          className="mt-2 w-full resize-y rounded-xl border border-[#E2EAF3] px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-[#93C5FD] focus:ring-2 focus:ring-[#DBEAFE]"
        />
        <div className="mt-1 flex justify-between text-xs text-slate-400"><span>{trimmedReason ? "" : "Please enter a reason."}</span><span>{reason.length}/500</span></div>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" disabled={busy} onClick={onClose} className="rounded-xl border border-[#E2EAF3] px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60">Keep request pending</button>
          <button type="submit" disabled={busy || !trimmedReason || reason.length > 500} className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50">{busy ? "Declining..." : "Decline request"}</button>
        </div>
      </form>
    </div>
  );
}

export function BookingDetailsDialog({
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
  onReview: (
    id: string,
    status: "CONFIRMED" | "CANCELLED",
    declineReason?: string
  ) => void;
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
  const [declineRequested, setDeclineRequested] = useState(false);
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
    <>
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
                onClick={() => setDeclineRequested(true)}
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
    {declineRequested && (
      <DeclineReasonDialog
        reservation={reservation}
        busy={reviewing}
        onClose={() => setDeclineRequested(false)}
        onSubmit={(reason) => {
          onReview(reservation.id, "CANCELLED", reason);
          setDeclineRequested(false);
        }}
      />
    )}
    </>
  );
}
