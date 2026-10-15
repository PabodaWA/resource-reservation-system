"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { minimumPartySize } from "@/lib/reservation-participants";
import { CalendarGlyph, CalendarIcon, CheckGlyph, ChevronIcon } from "./icons";
import { addDays, addMonths, calendarDays, combineLocal, dateSummary, inputClass, monthStart, relativeTime, startOfDay, toDateInput, type Availability, type ParticipantDraft, type Reservation } from "./model";

export function StepMark({ n }: { n: number }) {
  return (
    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#e8f2ff] text-[11px] font-bold text-[#2f6fed]">
      {n}
    </span>
  );
}

export function ConfirmStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 px-3 py-3">
      <p className="text-[11px] font-medium text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}

export function DetailRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-start gap-3">
      <dt className="flex items-center gap-2 font-medium text-slate-500">
        <span className="text-[#3b82f6]">{icon}</span>
        {label}
      </dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}

export function Panel({
  title,
  detail,
  icon,
  action,
  onAction,
  children,
}: {
  title: string;
  detail?: string;
  icon: ReactNode;
  action?: string;
  onAction?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-[15px] font-bold text-slate-900">
            <span className="text-[#2f6fed]">{icon}</span>
            {title}
          </h2>
          {detail && (
            <p className="mt-1 text-xs text-slate-500">{detail}</p>
          )}
        </div>
        {action && onAction && (
          <button
            type="button"
            onClick={onAction}
            className="shrink-0 text-sm font-semibold text-[#3b82f6] hover:text-[#2563eb]"
          >
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

export function QuickAction({
  icon,
  title,
  detail,
  onClick,
}: {
  icon: ReactNode;
  title: string;
  detail: string;
  onClick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-center gap-3 rounded-2xl bg-[#f4f8ff] px-3 py-3 text-left transition hover:bg-[#eaf2ff]"
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#3b82f6] shadow-sm">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-slate-900">
            {title}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">{detail}</span>
        </span>
        <ChevronIcon direction="right" />
      </button>
    </li>
  );
}

export function SummaryCard({
  value,
  label,
  detail,
  tone,
  icon,
  onClick,
}: {
  value: number;
  label: string;
  detail: string;
  tone: "blue" | "sand" | "green";
  icon: ReactNode;
  onClick?: () => void;
}) {
  const iconTones = {
    blue: "bg-[#e8f1ff] text-[#3b6fd8]",
    sand: "bg-[#fff4e5] text-[#e39b2b]",
    green: "bg-[#e7f8ee] text-[#1f9a57]",
  };

  const className =
    "flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white px-4 py-4 text-left shadow-sm";
  const body = (
    <>
      <span
        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconTones[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-700">
          {label}
        </span>
        <span className="mt-1 block text-2xl font-bold leading-none text-slate-900">
          {value}
        </span>
        <span className="mt-1 block text-xs text-slate-400">{detail}</span>
      </span>
      {onClick && <ChevronIcon direction="right" />}
    </>
  );

  if (!onClick) {
    return <div className={className}>{body}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`${className} transition hover:brightness-[0.98]`}
    >
      {body}
    </button>
  );
}

export function StatusPill({ reservation }: { reservation: Reservation }) {
  if (reservation.status === "CANCELLED") {
    return <AvailabilityPill label="Cancelled" />;
  }

  if (reservation.timing === "in_progress") {
    return (
      <span className="shrink-0 rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700">
        Now
      </span>
    );
  }

  if (reservation.timing === "past") {
    return (
      <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
        Completed
      </span>
    );
  }

  return (
    <span className="shrink-0 rounded-full bg-[#e7f8ee] px-2.5 py-1 text-xs font-semibold text-[#1f9d55]">
      Upcoming
    </span>
  );
}

export function AvailabilityPill({
  label,
  verbose = false,
}: {
  label: Availability | "Cancelled";
  verbose?: boolean;
}) {
  const styles =
    label === "Available"
      ? "bg-[#e7f8ee] text-[#1f9d55]"
      : label === "Limited"
        ? "bg-[#fff4d6] text-[#d97706]"
        : "bg-[#fde8e8] text-[#e11d48]";
  const text = verbose
    ? label === "Limited"
      ? "Limited Availability"
      : label === "Unavailable"
        ? "Not Available"
        : label
    : label === "Unavailable"
      ? "Unavailable"
      : label;

  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {text}
    </span>
  );
}

export function HeartButton({
  active,
  onClick,
  label,
  floating = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  floating?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={
        active ? `Remove ${label} from favourites` : `Save ${label} as a favourite`
      }
      className={`flex h-8 w-8 items-center justify-center rounded-full ${
        floating ? "bg-white/90 shadow-sm" : "hover:bg-rose-50"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className={`h-4 w-4 ${active ? "fill-rose-500 text-rose-500" : "fill-none text-slate-400"}`}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
      </svg>
    </button>
  );
}

export function ActivityRow({
  item,
}: {
  item: {
    id: string;
    kind: "confirmed" | "completed" | "cancelled";
    title: string;
    detail: string;
    at: string;
  };
}) {
  const tone =
    item.kind === "cancelled"
      ? "bg-rose-50 text-rose-500"
      : item.kind === "completed"
        ? "bg-emerald-50 text-emerald-600"
        : "bg-sky-50 text-sky-600";
  const [when, setWhen] = useState("");

  useEffect(() => {
    const update = () => setWhen(relativeTime(item.at));
    update();
    const timer = window.setInterval(update, 30_000);
    return () => window.clearInterval(timer);
  }, [item.at]);

  return (
    <li className="flex items-start gap-3">
      <span
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${tone}`}
      >
        {item.kind === "cancelled" ? (
          <span className="text-sm font-bold">×</span>
        ) : item.kind === "completed" ? (
          <CheckGlyph />
        ) : (
          <CalendarGlyph />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-800">{item.title}</p>
        <p className="truncate text-xs text-slate-500">{item.detail}</p>
      </div>
      <span suppressHydrationWarning className="shrink-0 text-xs text-slate-400">
        {when}
      </span>
    </li>
  );
}

export function BookingDateField({
  value,
  onChange,
}: {
  value: string;
  onChange: (date: string) => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selected = value ? combineLocal(value, "12:00") : null;
  const [month, setMonth] = useState(() => monthStart(selected ?? new Date()));

  useEffect(() => {
    if (!open) {
      return;
    }

    function onPointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const today = startOfDay(new Date());
  const latest = startOfDay(addDays(today, 90));
  const firstMonth = monthStart(today);
  const lastMonth = monthStart(latest);
  const days = calendarDays(month);

  const summary = dateSummary(value);

  return (
    <div ref={rootRef} className="relative">
      <p className="text-sm text-slate-200">Date</p>
      <button
        type="button"
        aria-expanded={open}
        aria-label="Choose a date from the calendar"
        onClick={() => {
          if (!open) {
            setMonth(monthStart(selected ?? new Date()));
          }
          setOpen((current) => !current);
        }}
        className={`mt-2 flex w-full items-center gap-3 rounded-lg bg-white px-3 py-2 text-left text-slate-800 ${
          open ? "ring-2 ring-blue-300" : ""
        }`}
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold">
            {summary.title}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500">
            {summary.detail}
          </span>
        </span>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50">
          <CalendarIcon />
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-30 mt-2 rounded-xl border border-slate-200 bg-white p-3 text-slate-800 shadow-xl">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              aria-label="Previous month"
              disabled={month.getTime() <= firstMonth.getTime()}
              onClick={() => setMonth(addMonths(month, -1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <ChevronIcon direction="left" />
            </button>
            <p className="text-sm font-semibold">
              {new Intl.DateTimeFormat("en-US", {
                month: "long",
                year: "numeric",
              }).format(month)}
            </p>
            <button
              type="button"
              aria-label="Next month"
              disabled={month.getTime() >= lastMonth.getTime()}
              onClick={() => setMonth(addMonths(month, 1))}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300 disabled:hover:bg-transparent"
            >
              <ChevronIcon direction="right" />
            </button>
          </div>

          <div className="mt-3 grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wide text-slate-400">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((label) => (
              <span key={label} className="flex h-8 items-center justify-center">
                {label}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              if (!day) {
                return <span key={`empty-${index}`} className="h-9" />;
              }

              const key = toDateInput(day);
              const disabled = day < today || day > latest;
              const isSelected = value === key;
              const isToday = toDateInput(today) === key;

              return (
                <button
                  key={key}
                  type="button"
                  disabled={disabled}
                  aria-pressed={isSelected}
                  aria-label={new Intl.DateTimeFormat("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                  }).format(day)}
                  onClick={() => {
                    onChange(key);
                    setOpen(false);
                  }}
                  className={`mx-auto flex h-9 w-9 items-center justify-center rounded-full text-sm ${
                    isSelected
                      ? "bg-blue-600 font-semibold text-white"
                      : disabled
                        ? "cursor-not-allowed text-slate-300"
                        : isToday
                          ? "font-semibold text-blue-700 ring-1 ring-blue-500 hover:bg-blue-50"
                          : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2">
            <button
              type="button"
              onClick={() => {
                onChange(toDateInput(today));
                setMonth(firstMonth);
                setOpen(false);
              }}
              className="rounded-md px-2 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-50"
            >
              Today
            </button>
            <p className="text-[11px] text-slate-400">Next 90 days</p>
          </div>
        </div>
      )}
    </div>
  );
}

export function StatusBadge({ reservation }: { reservation: Reservation }) {
  if (reservation.status === "CANCELLED") {
    return <Badge className="bg-rose-50 text-rose-600">Cancelled</Badge>;
  }

  if (reservation.status === "PENDING") {
    return <Badge className="bg-amber-50 text-amber-700">Pending Approval</Badge>;
  }

  if (reservation.timing === "in_progress") {
    return <Badge className="bg-sky-50 text-sky-700">Happening now</Badge>;
  }

  if (reservation.timing === "past") {
    return <Badge className="bg-emerald-50 text-emerald-700">Completed</Badge>;
  }

  return <Badge className="bg-emerald-50 text-emerald-700">Upcoming</Badge>;
}

export function ReservationStat({
  value,
  label,
  detail,
  tone,
  icon,
  active,
  onClick,
}: {
  value: number;
  label: string;
  detail: string;
  tone: "blue" | "sand" | "green" | "rose";
  icon: ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  const iconTones = {
    blue: "bg-[#e8f1ff] text-[#3b6fd8]",
    sand: "bg-[#fff4e5] text-[#e39b2b]",
    green: "bg-[#e7f8ee] text-[#1f9a57]",
    rose: "bg-[#fde8e8] text-[#e11d48]",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-3 rounded-2xl border bg-white px-4 py-4 text-left shadow-sm transition hover:border-blue-200 ${
        active ? "border-[#93c5fd] ring-2 ring-blue-100" : "border-slate-200/80"
      }`}
    >
      <span
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${iconTones[tone]}`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-slate-700">{label}</span>
        <span className="mt-0.5 block text-2xl font-bold leading-none text-slate-900">
          {value}
        </span>
        <span className="mt-1 block text-xs text-slate-400">{detail}</span>
      </span>
      <ChevronIcon direction="right" />
    </button>
  );
}

export function Badge({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {children}
    </span>
  );
}

export function EmptyState({
  title,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  detail: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <div className="px-2 py-10 text-center">
      <h3 className="font-semibold text-slate-800">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
        {detail}
      </p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export function ParticipantFields({
  capacity,
  participants,
  notify,
  onChange,
  onNotifyChange,
}: {
  capacity: number;
  participants: ParticipantDraft[];
  notify: boolean;
  onChange: (next: ParticipantDraft[]) => void;
  onNotifyChange: (next: boolean) => void;
}) {
  const extraSeats = capacity - 1;
  const minimum = minimumPartySize(capacity);
  const filled = participants.filter(
    (person) => person.name.trim() && person.email.trim()
  ).length;
  const partySize = filled + 1;
  const hasPerson = participants.some(
    (person) => person.name.trim() || person.email.trim()
  );

  function updatePerson(index: number, patch: Partial<ParticipantDraft>) {
    onChange(
      participants.map((person, personIndex) =>
        personIndex === index ? { ...person, ...patch } : person
      )
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-slate-700">
          People joining you
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-500">
          You count as 1. At least {minimum} of {capacity} seats must be
          filled (70%, rounded up). Add {minimum - 1} or more people, up to{" "}
          {extraSeats}.
        </p>
        <p
          className={`text-xs font-semibold ${
            partySize >= minimum ? "text-emerald-700" : "text-amber-700"
          }`}
        >
          {partySize} of {capacity} seats filled. At least {minimum} are required.
        </p>
      </div>
      {participants.map((person, index) => (
        <div key={index} className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            maxLength={80}
            value={person.name}
            onChange={(event) =>
              updatePerson(index, { name: event.target.value })
            }
            placeholder="Name"
            aria-label={`Person ${index + 1} name`}
            className={inputClass}
          />
          <input
            type="email"
            maxLength={254}
            value={person.email}
            onChange={(event) =>
              updatePerson(index, { email: event.target.value })
            }
            placeholder="Email"
            aria-label={`Person ${index + 1} email`}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() =>
              onChange(participants.filter((_, personIndex) => personIndex !== index))
            }
            className="mt-1 rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
            aria-label={`Remove person ${index + 1}`}
          >
            ✕
          </button>
        </div>
      ))}
      {participants.length < extraSeats && (
        <button
          type="button"
          onClick={() =>
            onChange([...participants, { name: "", email: "" }])
          }
          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Add a person
        </button>
      )}
      {hasPerson && (
        <label className="flex items-start gap-3 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => onNotifyChange(event.target.checked)}
            className="mt-1"
          />
          <span>
            Email them that this resource is reserved for this time.
          </span>
        </label>
      )}
    </div>
  );
}

export function FormField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

