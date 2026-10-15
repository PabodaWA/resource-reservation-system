"use client";

import { useEffect, useState, type ReactNode } from "react";
import { ActivityGlyph, DownloadIcon } from "./icons";
import { activityDot, activityIconColor, axisMax, formatShort, relativeTime, type ActivityItem, type ActivityKind, type AdminDashboardData } from "./model";

export function UserMetric({
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

export function StatCard({
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

export function ReservationStatus({
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

export function IconAction({
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

export function DetailField({
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

export function WeekBars({ days }: { days: { label: string; value: number }[] }) {
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

export function UsageDonut({
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

export function ActivityTime({ iso }: { iso: string }) {
  const [label, setLabel] = useState(() => formatShort(iso));

  useEffect(() => {
    setLabel(relativeTime(iso));
  }, [iso]);

  return <span className="shrink-0 text-xs text-slate-400">{label}</span>;
}

export function ActivityList({
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

export function Badge({
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

export function ReportDownload({
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

export function EmptyState({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mt-5 rounded-xl border border-dashed border-[#E2EAF3] px-4 py-8 text-center">
      <p className="font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

