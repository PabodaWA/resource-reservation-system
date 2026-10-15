"use client";

import { FormEvent, useState } from "react";
import { bookingNeedsApproval, categoryLabel, isCompanyVehicle, maxBookingDurationMs, subcategoryLabel } from "@/lib/resource-catalog";
import { ParticipantInputError, assertParticipantCapacity, minimumPartySize, parseParticipants } from "@/lib/reservation-participants";
import { BoxIcon, CalendarGlyph, ClockGlyph, EyeGlyph, LayersGlyph, PencilGlyph, PeopleIcon, PinIcon, ResourcePhoto, TrashGlyph } from "./icons";
import { FormField, ParticipantFields, StatusBadge } from "./widgets";
import { draftsFromReservation, endsLaterDay, ensureClockChoice, formatDuration, inputClass, isResourceFree, openEndChoices, openStartChoices, reservationSchedule, resolveSlot, resourceFacilities, toClockInput, toDateInput, type ParticipantDraft, type Reservation, type Resource, type UserDashboardData } from "./model";

export function ReservationRow({
  reservation,
  resource,
  cancelling,
  onCancel,
  onEdit,
  onView,
}: {
  reservation: Reservation;
  resource: Resource | null;
  cancelling: boolean;
  onCancel: () => void;
  onEdit: () => void;
  onView: () => void;
}) {
  const canCancel =
    (reservation.status === "CONFIRMED" || reservation.status === "PENDING") &&
    reservation.timing !== "past";
  const canEdit = reservation.status === "PENDING" && reservation.timing !== "past";
  const schedule = reservationSchedule(reservation.startTime, reservation.endTime);
  const facilities = resource ? resourceFacilities(resource) : "";
  const category = resource
    ? categoryLabel(resource.category)
    : categoryLabel(reservation.resourceCategory);

  return (
    <li className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
        <ResourcePhoto
          resource={{
            category: reservation.resourceCategory,
            subcategory: reservation.resourceSubcategory,
            name: reservation.resourceName,
            location: reservation.resourceLocation,
            images: resource?.images,
          }}
          className="h-36 w-full rounded-xl lg:h-32 lg:w-44"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base font-bold text-slate-900">
            {reservation.resourceName}
          </p>
          <ul className="mt-2 space-y-1 text-sm text-slate-500">
            <li className="flex items-center gap-2">
              <LayersGlyph className="h-4 w-4 shrink-0 text-slate-400" />
              <span className="truncate">
                {category} ·{" "}
                {subcategoryLabel(
                  resource?.subcategory ?? reservation.resourceSubcategory
                )}
              </span>
            </li>
            <li className="flex items-center gap-2">
              <PinIcon />
              <span className="truncate">{reservation.resourceLocation}</span>
            </li>
            {resource && (
              <li className="flex items-center gap-2">
                <PeopleIcon className="h-4 w-4 shrink-0" />
                Capacity: {resource.capacity}{" "}
                {resource.capacity === 1 ? "person" : "people"}
              </li>
            )}
            <li className="flex items-center gap-2">
              <BoxIcon />
              <span className="truncate">
                Facilities: {facilities || "Not listed"}
              </span>
            </li>
          </ul>
          {reservation.purpose && (
            <p className="mt-2 text-sm text-slate-500">{reservation.purpose}</p>
          )}
        </div>
        <div className="grid gap-2 text-sm text-slate-600 sm:grid-cols-3 lg:w-52 lg:grid-cols-1">
          <p className="flex items-start gap-2">
            <CalendarGlyph className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <span className="block text-xs text-slate-400">Date</span>
              {schedule.date}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ClockGlyph className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <span className="block text-xs text-slate-400">Time</span>
              {schedule.time}
            </span>
          </p>
          <p className="flex items-start gap-2">
            <ClockGlyph className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            <span>
              <span className="block text-xs text-slate-400">Duration</span>
              {schedule.duration}
            </span>
          </p>
        </div>
        <div className="flex flex-col items-start gap-3 lg:w-44 lg:items-end">
          <StatusBadge reservation={reservation} />
          <div className="flex flex-wrap gap-2 lg:justify-end">
            {resource && (
              <button
                type="button"
                onClick={onView}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#bfdbfe] px-3 py-2 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50"
              >
                <EyeGlyph />
                View Details
              </button>
            )}
            {canEdit && (
              <button
                type="button"
                onClick={onEdit}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#bfdbfe] px-3 py-2 text-sm font-semibold text-[#2563eb] transition hover:bg-blue-50"
              >
                <PencilGlyph />
                Edit
              </button>
            )}
            {canCancel && (
              <button
                type="button"
                onClick={onCancel}
                disabled={cancelling}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-60"
              >
                <TrashGlyph />
                {cancelling
                  ? "Cancelling..."
                  : reservation.status === "PENDING"
                    ? "Cancel Request"
                    : "Cancel"}
              </button>
            )}
          </div>
        </div>
      </div>
    </li>
  );
}

export function PendingEditDialog({
  reservation,
  resource,
  occupiedSlots,
  bookerEmail,
  saving,
  todayInput,
  latestInput,
  onClose,
  onSubmit,
}: {
  reservation: Reservation;
  resource: Resource;
  occupiedSlots: UserDashboardData["occupiedSlots"];
  bookerEmail: string;
  saving: boolean;
  todayInput: string;
  latestInput: string;
  onClose: () => void;
  onSubmit: (input: {
    title: string;
    purpose: string;
    startTime: string;
    endTime: string;
    participants: { name: string; email: string }[];
    notifyParticipants: boolean;
  }) => Promise<void>;
}) {
  const start = new Date(reservation.startTime);
  const end = new Date(reservation.endTime);
  const durationLimit = maxBookingDurationMs(resource.category);
  const vehicle = isCompanyVehicle(resource.category);
  const [date, setDate] = useState(toDateInput(start));
  const [startClock, setStartClock] = useState(toClockInput(start));
  const [endClock, setEndClock] = useState(
    vehicle ? `${toDateInput(end)}T${toClockInput(end)}` : toClockInput(end)
  );
  const [title, setTitle] = useState(reservation.title);
  const [purpose, setPurpose] = useState(reservation.purpose ?? "");
  const [participants, setParticipants] = useState<ParticipantDraft[]>(() =>
    draftsFromReservation(reservation, resource.capacity)
  );
  const [notify, setNotify] = useState(true);
  const [formError, setFormError] = useState("");
  const slot = resolveSlot(date, startClock, endClock, durationLimit);
  const startOptions = ensureClockChoice(
    openStartChoices(date, resource.id, occupiedSlots, durationLimit),
    startClock
  );
  const endOptions = startClock
    ? ensureClockChoice(
        openEndChoices(
          date,
          startClock,
          resource.id,
          occupiedSlots,
          durationLimit
        ),
        endClock
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
  const minimum = minimumPartySize(resource.capacity);
  const filledOthers = participants.filter(
    (person) => person.name.trim() && person.email.trim()
  ).length;
  const partyReady = resource.capacity <= 1 || filledOthers + 1 >= minimum;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    if (!slot.window) {
      setFormError(slot.error || "Choose a valid date and time.");
      return;
    }

    if (timeTaken) {
      setFormError("That resource is already booked for the selected time.");
      return;
    }

    if (!purpose.trim()) {
      setFormError("Enter a purpose for this booking.");
      return;
    }

    let filledPeople: { name: string; email: string }[] = [];

    try {
      if (resource.capacity > 1) {
        filledPeople = parseParticipants(participants);
        assertParticipantCapacity(resource.capacity, filledPeople, bookerEmail);
      }
    } catch (error) {
      if (error instanceof ParticipantInputError) {
        setFormError(error.message);
        return;
      }

      throw error;
    }

    try {
      await onSubmit({
        title: title.trim(),
        purpose: purpose.trim(),
        startTime: slot.window.start.toISOString(),
        endTime: slot.window.end.toISOString(),
        participants: filledPeople.map((person) => ({
          name: person.name.trim().replace(/\s+/g, " "),
          email: person.email.trim().toLowerCase(),
        })),
        notifyParticipants: notify && filledPeople.length > 0,
      });
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : "Unable to update this request."
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <form
        onSubmit={(event) => void handleSubmit(event)}
        className="max-h-[min(90vh,760px)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold">Edit pending request</h2>
            <p className="mt-1 text-sm text-slate-500">
              {resource.name} · {resource.location}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
            aria-label="Close edit form"
          >
            ✕
          </button>
        </div>

        <div className="mt-5 space-y-4">
          <FormField label="Date">
            <input
              type="date"
              required
              min={todayInput}
              max={latestInput}
              value={date}
              onChange={(event) => setDate(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Start time">
              <select
                required
                value={startClock}
                onChange={(event) => {
                  setStartClock(event.target.value);
                  setEndClock("");
                }}
                className={inputClass}
              >
                <option value="">Select time</option>
                {startOptions.map((choice) => (
                  <option key={`edit-start-${choice.value}`} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="End time">
              <select
                required
                value={endClock}
                onChange={(event) => setEndClock(event.target.value)}
                disabled={!startClock}
                className={inputClass}
              >
                <option value="">
                  {startClock ? "Select time" : "Choose a start time first"}
                </option>
                {endOptions.map((choice) => (
                  <option key={`edit-end-${choice.value}`} value={choice.value}>
                    {choice.label}
                  </option>
                ))}
              </select>
            </FormField>
          </div>
          <p className="text-sm text-slate-500">
            {vehicle
              ? "A vehicle trip can last from 15 minutes to 36 hours. It stays pending until an administrator approves it."
              : "Leave the time as it is, or choose another slot. A time outside 8:00 AM–8:00 PM stays pending. A time inside office hours is confirmed when you save."}
          </p>
          {slot.window && !timeTaken && (
            <p className="text-sm text-slate-500">
              {formatDuration(slot.window.end.getTime() - slot.window.start.getTime())}
              {endsLaterDay(date, startClock, endClock)
                ? " · continues past this day"
                : ""}
            </p>
          )}
          {(formError || slot.error || timeTaken) && (
            <p className="text-sm text-amber-700">
              {formError ||
                (timeTaken
                  ? "That resource is already booked for the selected time."
                  : slot.error)}
            </p>
          )}
          <FormField label="Title">
            <input
              required
              maxLength={120}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={inputClass}
            />
          </FormField>
          <FormField label="Purpose">
            <input
              required
              maxLength={500}
              value={purpose}
              onChange={(event) => setPurpose(event.target.value)}
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
              notify={notify}
              onChange={setParticipants}
              onNotifyChange={setNotify}
            />
          )}
          {needsApproval && (
            <p className="text-sm leading-6 text-amber-700">
              {vehicle
                ? "This vehicle booking stays pending until an administrator approves it. Added people are emailed after it is confirmed."
                : "This time is outside office hours, so the request stays pending until an administrator approves it. Added people are emailed after it is confirmed."}
            </p>
          )}
          {slot.window && !needsApproval && !timeTaken && !vehicle && (
            <p className="text-sm leading-6 text-emerald-700">
              This time is inside office hours. Saving confirms the booking.
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving || !slot.window || timeTaken || !partyReady}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

