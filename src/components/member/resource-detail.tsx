"use client";

import { FormEvent, useState } from "react";
import { bookingNeedsApproval, categoryLabel, isCompanyVehicle, maxBookingDurationMs, subcategoryLabel } from "@/lib/resource-catalog";
import { minimumPartySize } from "@/lib/reservation-participants";
import { AvailabilityPill, ConfirmStat, DetailRow, FormField, ParticipantFields, StatusBadge, StepMark } from "./widgets";
import { BoxIcon, CalendarGlyph, ClockGlyph, GalleryFrame, NoteIcon, PeopleIcon, PinIcon } from "./icons";
import { addMonths, bookingWindowNote, combineLocal, dayLoad, detailMonthDays, endsLaterDay, formatClockLabel, formatDuration, formatEndChoice, formatHourDuration, inputClass, isResourceFree, monthStart, openEndChoices, openStartChoices, reservationSchedule, resourceBlurb, resourceFacilities, resourceGallery, startOfDay, toDateInput, type Availability, type ParticipantDraft, type Reservation, type Resource, type UserDashboardData } from "./model";

export function ResourceDetailView({
  resource,
  favourite,
  availability,
  date,
  startClock,
  endClock,
  title,
  purpose,
  slot,
  occupiedSlots,
  participants,
  notifyParticipants,
  saving,
  photoIndex,
  todayInput,
  latestInput,
  onPhoto,
  onClose,
  onFavourite,
  onDate,
  onStart,
  onEnd,
  onTitle,
  onPurpose,
  onParticipants,
  onNotify,
  onBook,
  allowedToBook,
  onEdit,
  reservation,
}: {
  resource: Resource;
  favourite: boolean;
  availability: Availability;
  date: string;
  startClock: string;
  endClock: string;
  title: string;
  purpose: string;
  slot: { window: { start: Date; end: Date } | null; error: string };
  occupiedSlots: UserDashboardData["occupiedSlots"];
  participants: ParticipantDraft[];
  notifyParticipants: boolean;
  saving: boolean;
  photoIndex: number;
  todayInput: string;
  latestInput: string;
  onPhoto: (index: number) => void;
  onClose: () => void;
  onFavourite: () => void;
  onDate: (date: string) => void;
  onStart: (startClock: string) => void;
  onEnd: (endClock: string) => void;
  onTitle: (title: string) => void;
  onPurpose: (purpose: string) => void;
  onParticipants: (next: ParticipantDraft[]) => void;
  onNotify: (next: boolean) => void;
  onBook: (event: FormEvent<HTMLFormElement>) => void;
  allowedToBook: boolean;
  onEdit?: () => void;
  reservation: Reservation | null;
}) {
  const photos = resourceGallery(resource);
  const imageIndex = photos.length === 0 ? 0 : photoIndex % photos.length;
  const blurb = resourceBlurb(resource);
  const facilities = resourceFacilities(resource);
  const minimum = minimumPartySize(resource.capacity);
  const filledOthers = participants.filter(
    (person) => person.name.trim() && person.email.trim()
  ).length;
  const partyReady =
    resource.capacity <= 1 || filledOthers + 1 >= minimum;
  const durationLimit = maxBookingDurationMs(resource.category);
  const vehicle = isCompanyVehicle(resource.category);
  const startOptions = openStartChoices(
    date,
    resource.id,
    occupiedSlots,
    durationLimit
  );
  const endOptions = startClock
    ? openEndChoices(
        date,
        startClock,
        resource.id,
        occupiedSlots,
        durationLimit
      )
    : [];
  const timeTaken = Boolean(
    slot.window && !isResourceFree(resource.id, slot.window, occupiedSlots)
  );
  const needsApproval = Boolean(
    slot.window &&
      !timeTaken &&
      bookingNeedsApproval(
        resource.category,
        slot.window.start,
        slot.window.end,
        Intl.DateTimeFormat().resolvedOptions().timeZone
      )
  );
  const timeMessage = timeTaken
    ? "That resource is already booked for the selected time."
    : startClock && endClock && slot.error
      ? slot.error
      : bookingWindowNote(date, startClock, endOptions, durationLimit);
  const selectedDay = date ? combineLocal(date, "12:00") : new Date();
  const [month, setMonth] = useState(() => monthStart(selectedDay));
  const earliest = startOfDay(combineLocal(todayInput, "12:00"));
  const latest = startOfDay(combineLocal(latestInput, "12:00"));
  const days = detailMonthDays(month);

  return (
    <section>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-sm text-slate-400">
            <button
              type="button"
              onClick={onClose}
              className="font-medium text-slate-500 hover:text-[#2f6fed]"
            >
              {reservation ? "My Reservations" : "Browse Resources"}
            </button>
            <span className="mx-1.5">›</span>
            <span className="text-slate-600">{resource.name}</span>
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              {resource.name}
            </h1>
            <AvailabilityPill label={availability} verbose />
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{blurb}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onFavourite}
            aria-pressed={favourite}
            aria-label={
              favourite
                ? `Remove ${resource.name} from favourites`
                : `Save ${resource.name} as a favourite`
            }
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm hover:text-rose-500"
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className={`h-4 w-4 ${favourite ? "fill-rose-500 text-rose-500" : "fill-none"}`}
              stroke="currentColor"
              strokeWidth="1.8"
            >
              <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#8ec0ff] bg-white px-4 py-2.5 text-sm font-semibold text-[#2f6fed] shadow-sm hover:bg-blue-50"
          >
            {reservation ? "‹ Back to Reservations" : "‹ Back to Resources"}
          </button>
        </div>
      </div>

      <div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative">
              <GalleryFrame
                src={photos[imageIndex]}
                resource={resource}
                className="h-56 w-full sm:h-72"
              />
              {photos.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() =>
                      onPhoto((imageIndex - 1 + photos.length) % photos.length)
                    }
                    className="absolute left-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() => onPhoto((imageIndex + 1) % photos.length)}
                    className="absolute right-3 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-slate-700 shadow"
                  >
                    ›
                  </button>
                </>
              )}
            </div>
            {photos.length > 1 && (
              <div className="flex gap-2 p-3">
                {photos.map((photo, index) => (
                  <button
                    key={`${index}-${photo.slice(0, 48)}`}
                    type="button"
                    onClick={() => onPhoto(index)}
                    aria-label={`Show photo ${index + 1}`}
                    className={`h-14 w-20 overflow-hidden rounded-lg border ${
                      index === imageIndex
                        ? "border-[#3b82f6] ring-2 ring-blue-100"
                        : "border-slate-200"
                    }`}
                  >
                    <GalleryFrame
                      src={photo}
                      resource={resource}
                      className="h-14 w-20"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">Details</h2>
            <dl className="mt-4 space-y-4 text-sm">
              <DetailRow icon={<PeopleIcon className="h-4 w-4" />} label="Category">
                {categoryLabel(resource.category)}
              </DetailRow>
              <DetailRow icon={<BoxIcon />} label="Subcategory">
                {subcategoryLabel(resource.subcategory)}
              </DetailRow>
              <DetailRow icon={<PeopleIcon className="h-4 w-4" />} label="Capacity">
                {resource.capacity} {resource.capacity === 1 ? "person" : "people"}
              </DetailRow>
              <DetailRow icon={<PinIcon />} label="Location">
                {resource.location}
              </DetailRow>
              <DetailRow icon={<BoxIcon />} label="Facilities">
                {facilities || "Not listed"}
              </DetailRow>
              <DetailRow icon={<NoteIcon />} label="Description">
                {blurb}
              </DetailRow>
            </dl>
          </div>
        </div>

        {reservation ? (
          <ReservationReadonly reservation={reservation} onEdit={onEdit} />
        ) : !allowedToBook ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="text-base font-bold text-slate-900">
              Meeting rooms are limited
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Only a manager, team leader, or scrum master can book a meeting
              room. Ask one of them if you need this room.
            </p>
          </section>
        ) : (
        <form
          onSubmit={onBook}
          className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
        >
          <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-3 text-sm font-semibold text-[#2f6fed]">
            <CalendarGlyph className="h-4 w-4" />
            Book a Reservation
          </div>

          <div className="space-y-6 pt-5">
              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <StepMark n={1} />
                  Select Date
                </h3>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_148px]">
                  <div>
                    <div className="flex items-center justify-between">
                      <button
                        type="button"
                        aria-label="Previous month"
                        disabled={month.getTime() <= monthStart(earliest).getTime()}
                        onClick={() => setMonth(addMonths(month, -1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      >
                        ‹
                      </button>
                      <p className="text-sm font-semibold text-slate-800">
                        {new Intl.DateTimeFormat("en-US", {
                          month: "long",
                          year: "numeric",
                        }).format(month)}
                      </p>
                      <button
                        type="button"
                        aria-label="Next month"
                        disabled={month.getTime() >= monthStart(latest).getTime()}
                        onClick={() => setMonth(addMonths(month, 1))}
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30"
                      >
                        ›
                      </button>
                    </div>
                    <div className="mt-3 grid grid-cols-7 gap-y-1 text-center text-[11px] font-semibold text-slate-400">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                        <span key={day}>{day}</span>
                      ))}
                    </div>
                    <div className="mt-1 grid grid-cols-7 gap-y-1 text-center">
                      {days.map((day) => {
                        const key = toDateInput(day);
                        const inMonth = day.getMonth() === month.getMonth();
                        const tooEarly = startOfDay(day).getTime() < earliest.getTime();
                        const tooLate = startOfDay(day).getTime() > latest.getTime();
                        const selected = key === date;
                        const load = dayLoad(resource.id, day, occupiedSlots);
                        const disabled = !inMonth || tooEarly || tooLate || load === "closed";

                        return (
                          <button
                            key={key}
                            type="button"
                            disabled={disabled}
                            onClick={() => onDate(key)}
                            className={`relative mx-auto flex h-8 w-8 items-center justify-center rounded-full text-xs ${
                              selected
                                ? "bg-[#3b82f6] font-bold text-white"
                                : disabled
                                  ? "cursor-not-allowed text-slate-300"
                                  : inMonth
                                    ? "text-slate-700 hover:bg-blue-50"
                                    : "text-slate-300"
                            }`}
                          >
                            {day.getDate()}
                            {inMonth && !selected && load !== "closed" && (
                              <span
                                className={`absolute bottom-0.5 h-1 w-1 rounded-full ${
                                  load === "full"
                                    ? "bg-rose-500"
                                    : load === "partial"
                                      ? "bg-amber-500"
                                      : "bg-emerald-500"
                                }`}
                              />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                  <div className="space-y-3">
                    <ul className="space-y-2 text-xs text-slate-500">
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-emerald-500" />
                        Available
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-amber-500" />
                        Partially booked
                      </li>
                      <li className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-rose-500" />
                        Fully booked
                      </li>
                    </ul>
                    <div className="rounded-xl border border-slate-200 px-3 py-3">
                      <p className="flex items-center gap-2 text-xs text-slate-500">
                        <CalendarGlyph className="h-4 w-4" />
                        Selected Date
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-900">
                        {date
                          ? new Intl.DateTimeFormat("en-GB", {
                              weekday: "short",
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            }).format(combineLocal(date, "12:00"))
                          : "Choose a date"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <StepMark n={2} />
                  Select Time
                </h3>
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  {vehicle
                    ? "A vehicle trip lasts at least 15 minutes and at most 36 hours, and it must finish before the next reservation. An administrator must approve it."
                    : "A booking lasts at least 15 minutes and at most 12 hours, and it must finish before the next reservation."}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <FormField label="Start time">
                    <select
                      required
                      value={startClock}
                      onChange={(event) => onStart(event.target.value)}
                      aria-label="Start time"
                      className={inputClass}
                    >
                      <option value="">Select time</option>
                      {startOptions.map((choice) => (
                        <option key={`detail-start-${choice.value}`} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                  <FormField label="End time">
                    <select
                      required
                      value={endClock}
                      onChange={(event) => onEnd(event.target.value)}
                      aria-label="End time"
                      disabled={!startClock}
                      className={inputClass}
                    >
                      <option value="">
                        {startClock ? "Select time" : "Choose a start time first"}
                      </option>
                      {endOptions.map((choice) => (
                        <option key={`detail-end-${choice.value}`} value={choice.value}>
                          {choice.label}
                        </option>
                      ))}
                    </select>
                  </FormField>
                </div>
                {date && startOptions.length === 0 && (
                  <p className="mt-3 text-sm text-amber-700">
                    No start time on this date has a free 15-minute gap.
                  </p>
                )}
                {slot.window && !timeTaken && (
                  <p className="mt-3 text-sm text-slate-500">
                    {formatDuration(slot.window.end.getTime() - slot.window.start.getTime())}
                    {endsLaterDay(date, startClock, endClock)
                      ? " · continues past this day"
                      : ""}
                  </p>
                )}
                {timeMessage && (
                  <p className={`mt-3 text-sm ${timeTaken || (startClock && endClock && slot.error) ? "text-amber-700" : "text-slate-500"}`}>
                    {timeMessage}
                  </p>
                )}
              </div>

              <div>
                <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900">
                  <StepMark n={3} />
                  Confirm Reservation
                </h3>
                <div className="mt-4 grid gap-2 sm:grid-cols-3">
                  <ConfirmStat
                    label="Date"
                    value={
                      date
                        ? new Intl.DateTimeFormat("en-GB", {
                            weekday: "short",
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          }).format(combineLocal(date, "12:00"))
                        : "—"
                    }
                  />
                  <ConfirmStat
                    label="Time"
                    value={
                      startClock && endClock
                        ? `${formatClockLabel(startClock)} – ${formatEndChoice(date, endClock)}`
                        : "Select a time"
                    }
                  />
                  <ConfirmStat
                    label="Duration"
                    value={
                      slot.window
                        ? formatHourDuration(
                            slot.window.end.getTime() - slot.window.start.getTime()
                          )
                        : "—"
                    }
                  />
                </div>
                <div className="mt-4 space-y-3">
                  <FormField label="Reservation title">
                    <input
                      required
                      maxLength={120}
                      value={title}
                      onChange={(event) => onTitle(event.target.value)}
                      className={inputClass}
                    />
                  </FormField>
                  <FormField label="Purpose">
                    <input
                      required
                      maxLength={500}
                      value={purpose}
                      onChange={(event) => onPurpose(event.target.value)}
                      placeholder="What is this booking for?"
                      className={inputClass}
                    />
                  </FormField>
                  {resource.capacity <= 1 ? (
                    <p className="text-sm text-slate-500">
                      This resource fits one person, so the booking is only for you.
                    </p>
                  ) : (
                    <ParticipantFields
                      capacity={resource.capacity}
                      participants={participants}
                      notify={notifyParticipants}
                      onChange={onParticipants}
                      onNotifyChange={onNotify}
                    />
                  )}
                </div>
                {needsApproval && (
                  <p className="mt-4 text-sm leading-6 text-amber-700">
                    {vehicle
                      ? "An administrator must approve this vehicle booking before the trip is confirmed."
                      : "This time is outside office hours (8:00 AM–8:00 PM). It stays pending until an administrator approves it."}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={saving || !slot.window || timeTaken || !partyReady}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-[#3b82f6] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[#2f74ea] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <CalendarGlyph className="h-4 w-4" />
                  {saving
                    ? "Booking..."
                    : needsApproval
                      ? "Request approval"
                      : "Book Now"}
                </button>
              </div>
          </div>
        </form>
        )}
      </div>
    </section>
  );
}

export function ReservationReadonly({
  reservation,
  onEdit,
}: {
  reservation: Reservation;
  onEdit?: () => void;
}) {
  const schedule = reservationSchedule(reservation.startTime, reservation.endTime);
  const canEdit =
    reservation.status === "PENDING" &&
    reservation.timing !== "past" &&
    Boolean(onEdit);

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-[#2f6fed]">
          <CalendarGlyph className="h-4 w-4" />
          Reservation details
        </h2>
        <StatusBadge reservation={reservation} />
      </div>
      <dl className="mt-5 space-y-4 text-sm">
        <DetailRow icon={<CalendarGlyph className="h-4 w-4" />} label="Date">
          {schedule.date}
        </DetailRow>
        <DetailRow icon={<ClockGlyph className="h-4 w-4" />} label="Time">
          {schedule.time}
        </DetailRow>
        <DetailRow icon={<ClockGlyph className="h-4 w-4" />} label="Duration">
          {schedule.duration}
        </DetailRow>
        <DetailRow icon={<NoteIcon />} label="Title">
          {reservation.title}
        </DetailRow>
        {reservation.purpose && (
          <DetailRow icon={<NoteIcon />} label="Purpose">
            {reservation.purpose}
          </DetailRow>
        )}
        {reservation.participants.length > 0 && (
          <DetailRow icon={<PeopleIcon className="h-4 w-4" />} label="With">
            {reservation.participants.map((person) => person.name).join(", ")}
          </DetailRow>
        )}
      </dl>
      {canEdit ? (
        <div className="mt-5 space-y-3">
          <p className="rounded-xl bg-amber-50 px-3 py-3 text-sm leading-6 text-amber-800">
            This request is waiting for approval. You can change the title,
            purpose, people, and the time.
          </p>
          <button
            type="button"
            onClick={onEdit}
            className="inline-flex items-center rounded-xl border border-[#bfdbfe] px-4 py-2.5 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50"
          >
            Edit request
          </button>
        </div>
      ) : (
        <p className="mt-5 rounded-xl bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-500">
          This booking is view only. The date, time, and people cannot be
          changed from here.
        </p>
      )}
    </section>
  );
}

