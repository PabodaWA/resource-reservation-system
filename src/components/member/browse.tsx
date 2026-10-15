"use client";

import { subcategoryLabel } from "@/lib/resource-catalog";
import { AvailabilityPill, HeartButton } from "./widgets";
import { BoxIcon, PeopleIcon, PinIcon, ResourcePhoto } from "./icons";
import { type Availability, type Resource } from "./model";

export function ResourceCard({
  resource,
  favourite,
  availability,
  onFavourite,
  onView,
}: {
  resource: Resource;
  favourite: boolean;
  availability: Availability;
  onFavourite: () => void;
  onView: () => void;
}) {
  const equipment =
    resource.category === "SHARED_EQUIPMENT" ||
    resource.category === "COMPANY_VEHICLES";

  return (
    <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="relative">
        <ResourcePhoto resource={resource} className="h-36 w-full" />
        <div className="absolute right-3 top-3">
          <HeartButton
            active={favourite}
            onClick={onFavourite}
            label={resource.name}
            floating
          />
        </div>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-[15px] font-bold text-slate-900">
          {resource.name}
        </h3>
        <div className="mt-2 space-y-1.5 text-sm text-slate-500">
          <p className="flex items-center gap-2">
            <BoxIcon />
            <span className="truncate">
              {subcategoryLabel(resource.subcategory)}
            </span>
          </p>
          {equipment ? null : (
            <p className="flex items-center gap-2">
              <PeopleIcon className="h-4 w-4 shrink-0" />
              Capacity: {resource.capacity}{" "}
              {resource.capacity === 1 ? "person" : "people"}
            </p>
          )}
          <p className="flex items-center gap-2">
            <PinIcon />
            <span className="truncate">{resource.location}</span>
          </p>
        </div>
        <div className="mt-3">
          <AvailabilityPill label={availability} verbose />
        </div>
        <button
          type="button"
          onClick={onView}
          className="mt-4 w-full rounded-lg border border-[#3b82f6] py-2 text-sm font-semibold text-[#3b82f6] transition hover:bg-blue-50"
        >
          View Details
        </button>
      </div>
    </article>
  );
}

