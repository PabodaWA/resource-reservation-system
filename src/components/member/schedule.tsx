"use client";

import { useMemo, useState } from "react";
import { ChevronIcon, PinIcon, ResourcePhoto } from "./icons";
import { EmptyState, StatusPill } from "./widgets";
import { addMonths, calendarDays, combineLocal, dateSummary, formatClockSpan, monthStart, reservationDayKeys, scheduleAnchor, startOfDay, toDateInput, type Reservation, type Resource } from "./model";

export function UpcomingSchedule({
  reservations,
  resources,
  onOpen,
  onBrowse,
}: {
  reservations: Reservation[];
  resources: Resource[];
  onOpen: (reservation: Reservation) => void;
  onBrowse: () => void;
}) {
  const today = startOfDay(new Date());
  const todayKey = toDateInput(today);
  const anchorKey = scheduleAnchor(reservations, todayKey);
  const [month, setMonth] = useState(() =>
    monthStart(combineLocal(anchorKey, "12:00"))
  );
  const [selectedKey, setSelectedKey] = useState(anchorKey);
  const bookedDays = useMemo(() => {
    const map = new Map<string, Reservation[]>();

    for (const reservation of reservations) {
      for (const key of reservationDayKeys(reservation)) {
        const list = map.get(key);

        if (list) {
          list.push(reservation);
        } else {
          map.set(key, [reservation]);
        }
      }
    }

    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
      );
    }

    return map;
  }, [reservations]);
  const days = calendarDays(month);
  const selected = bookedDays.get(selectedKey) ?? [];
  const summary = dateSummary(selectedKey);
  const monthLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
  }).format(month);

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(240px,280px)_minmax(0,1fr)] lg:items-start">
      <div>
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => setMonth(addMonths(month, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <ChevronIcon direction="left" />
          </button>
          <p className="text-sm font-semibold text-slate-900">{monthLabel}</p>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => setMonth(addMonths(month, 1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
          >
            <ChevronIcon direction="right" />
          </button>
        </div>

        <div
          className="mt-3 grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400"
          aria-hidden="true"
        >
          {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
            <span key={label} className="flex h-8 items-center justify-center">
              {label}
            </span>
          ))}
        </div>

        <div
          className="grid grid-cols-7"
          role="group"
          aria-label="Upcoming schedule"
        >
          {days.map((day, index) => {
            if (!day) {
              return <span key={`empty-${index}`} className="h-10" />;
            }

            const key = toDateInput(day);
            const count = bookedDays.get(key)?.length ?? 0;
            const isSelected = key === selectedKey;
            const isToday = key === todayKey;
            const label = new Intl.DateTimeFormat("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            }).format(day);

            return (
              <button
                key={key}
                type="button"
                aria-pressed={isSelected}
                aria-label={
                  count === 0
                    ? label
                    : `${label}, ${count} booking${count === 1 ? "" : "s"}`
                }
                onClick={() => setSelectedKey(key)}
                className={`mx-auto flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm ${
                  isSelected
                    ? "bg-[#3b82f6] font-semibold text-white"
                    : isToday
                      ? "font-semibold text-[#2563eb] ring-1 ring-[#93c5fd] hover:bg-blue-50"
                      : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <span className="leading-none">{day.getDate()}</span>
                <span
                  className={`mt-1 h-1 w-1 rounded-full ${
                    count === 0
                      ? "bg-transparent"
                      : isSelected
                        ? "bg-white"
                        : "bg-[#3b82f6]"
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
          <button
            type="button"
            onClick={() => {
              setSelectedKey(todayKey);
              setMonth(monthStart(today));
            }}
            className="rounded-md px-2 py-1 text-xs font-semibold text-[#2563eb] hover:bg-blue-50"
          >
            Today
          </button>
          <p className="flex items-center gap-1.5 text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 rounded-full bg-[#3b82f6]" />
            Booked day
          </p>
        </div>
      </div>

      <div className="min-w-0 border-t border-slate-100 pt-4 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
        <p className="text-sm font-semibold text-slate-900" aria-live="polite">
          {summary.title}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {selected.length === 0
            ? summary.detail
            : `${summary.detail} · ${selected.length} booking${selected.length === 1 ? "" : "s"}`}
        </p>

        {selected.length === 0 ? (
          reservations.length === 0 ? (
            <EmptyState
              title="No upcoming reservations"
              detail="Book a resource and it will show up here."
              actionLabel="Browse resources"
              onAction={onBrowse}
            />
          ) : (
            <p className="mt-4 text-sm leading-6 text-slate-500">
              Nothing is scheduled on this day.
            </p>
          )
        ) : (
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {selected.map((reservation) => (
              <li key={`${reservation.id}-${selectedKey}`}>
                <button
                  type="button"
                  onClick={() => onOpen(reservation)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 p-2.5 text-left transition hover:border-blue-100 hover:bg-slate-50"
                >
                  <ResourcePhoto
                    resource={{
                      category: reservation.resourceCategory,
                      subcategory: reservation.resourceSubcategory,
                      name: reservation.resourceName,
                      location: reservation.resourceLocation,
                      images: resources.find(
                        (item) => item.id === reservation.resourceId
                      )?.images,
                    }}
                    className="h-14 w-20 rounded-xl"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-[#2563eb]">
                      {formatClockSpan(
                        reservation.startTime,
                        reservation.endTime
                      )}
                    </p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {reservation.resourceName}
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <PinIcon />
                      <span className="truncate">
                        {reservation.resourceLocation}
                      </span>
                    </p>
                  </div>
                  <StatusPill reservation={reservation} />
                  <ChevronIcon direction="right" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

