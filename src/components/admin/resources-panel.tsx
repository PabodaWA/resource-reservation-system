"use client";

import { FormEvent, useState } from "react";
import { RESOURCE_CATALOG, categoryLabel, subcategoriesFor, subcategoryLabel } from "@/lib/resource-catalog";
import { MAX_RESOURCE_IMAGES } from "@/lib/resource-images";
import { RESOURCE_LOCATIONS } from "@/lib/resource-locations";
import { CategoryGlyph, ChevronLeftIcon, ChevronRightIcon, EyeIcon, LayersIcon, PencilIcon, SearchIcon, TrashIcon, UsersIcon } from "./icons";
import { USER_PAGE_SIZE, categoryStyle, emptyResource, inRange, inputClass, pageList, percentChange, readResourceImage, shareOf, startOfMonth, type AdminDashboardData } from "./model";
import { UserMetric } from "./widgets";

export function ResourcesPanel({
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

export function ResourceDialog({
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

