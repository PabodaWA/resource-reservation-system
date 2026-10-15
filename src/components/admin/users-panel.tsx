"use client";

import { jobPositionLabel } from "@/lib/job-position";
import { ChevronLeftIcon, ChevronRightIcon, PencilIcon, SearchIcon, ShieldIcon, TrashIcon, UserIcon, UsersIcon } from "./icons";
import { USER_PAGE_SIZE, avatarTone, formatJoined, inRange, initials, isAccountLocked, pageList, percentChange, shareOf, startOfMonth, type AdminDashboardData } from "./model";
import { UserMetric } from "./widgets";

export function UsersPanel({
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

