"use client";

import { type ReactNode } from "react";
import { type ActivityKind, type Section } from "./model";

export function CategoryGlyph({ category }: { category: string }) {
  if (category === "Meeting rooms" || category === "Other shared facilities") {
    return <BuildingIcon />;
  }

  if (
    category === "Shared desks and workspaces" ||
    category === "Shared equipment"
  ) {
    return <MonitorIcon />;
  }

  return <LayersIcon />;
}

export function SectionIcon({ id }: { id: Section }) {
  if (id === "dashboard") return <HomeIcon />;
  if (id === "users") return <UsersIcon />;
  if (id === "resources") return <LayersIcon />;
  if (id === "reservations") return <CalendarIcon />;
  if (id === "pending") return <ClockIcon />;
  if (id === "reports") return <ChartIcon />;
  if (id === "notifications") return <BellIcon />;
  return <UserIcon />;
}

export function ActivityGlyph({ kind }: { kind: ActivityKind }) {
  if (kind === "reservation") return <CalendarIcon />;
  if (kind === "resource") return <PencilIcon />;
  if (kind === "user") return <UserIcon />;
  return <CancelIcon />;
}

export function IconFrame({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-[18px] w-[18px]"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function HomeIcon() {
  return (
    <IconFrame>
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </IconFrame>
  );
}

export function UsersIcon() {
  return (
    <IconFrame>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 4.13a3 3 0 0 1 0 5.75" />
    </IconFrame>
  );
}

export function LayersIcon() {
  return (
    <IconFrame>
      <path d="m12 3 9 5-9 5-9-5 9-5z" />
      <path d="m3 12 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </IconFrame>
  );
}

export function CalendarIcon() {
  return (
    <IconFrame>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M8 3v4M16 3v4M3 10h18" />
    </IconFrame>
  );
}

export function ChartIcon() {
  return (
    <IconFrame>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </IconFrame>
  );
}

export function DownloadIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M12 4v11" />
      <path d="m7 11 5 5 5-5" />
      <path d="M5 20h14" />
    </svg>
  );
}

export function BellIcon() {
  return (
    <IconFrame>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 7 3 9H3c0-2 3-2 3-9" />
      <path d="M10 21a2 2 0 0 0 4 0" />
    </IconFrame>
  );
}

export function UserIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19a7 7 0 0 1 14 0" />
    </IconFrame>
  );
}

export function ClockIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </IconFrame>
  );
}

export function SearchIcon() {
  return (
    <IconFrame>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </IconFrame>
  );
}

export function DonutIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3" />
    </IconFrame>
  );
}

export function PencilIcon() {
  return (
    <IconFrame>
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4z" />
    </IconFrame>
  );
}

export function PlusIcon() {
  return (
    <IconFrame>
      <path d="M12 5v14M5 12h14" />
    </IconFrame>
  );
}

export function ShieldIcon() {
  return (
    <IconFrame>
      <path d="M12 3 5 6v6c0 4.2 2.8 7.2 7 9 4.2-1.8 7-4.8 7-9V6z" />
    </IconFrame>
  );
}

export function EyeIcon() {
  return (
    <IconFrame>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </IconFrame>
  );
}

export function BuildingIcon() {
  return (
    <IconFrame>
      <path d="M4 20V6l8-3 8 3v14" />
      <path d="M9 20v-5h6v5" />
      <path d="M9 9h.01M15 9h.01M9 13h.01M15 13h.01" />
    </IconFrame>
  );
}

export function MonitorIcon() {
  return (
    <IconFrame>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </IconFrame>
  );
}

export function TrashIcon() {
  return (
    <IconFrame>
      <path d="M4 7h16" />
      <path d="M9 7V5h6v2" />
      <path d="M8 7l1 12h6l1-12" />
    </IconFrame>
  );
}

export function CheckIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.3 2.3 4.7-5" />
    </IconFrame>
  );
}

export function CancelIcon() {
  return (
    <IconFrame>
      <circle cx="12" cy="12" r="8" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </IconFrame>
  );
}

export function MenuIcon() {
  return (
    <IconFrame>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </IconFrame>
  );
}

export function ChevronIcon() {
  return (
    <svg viewBox="0 0 20 20" className="hidden h-4 w-4 text-slate-400 sm:block" aria-hidden="true">
      <path
        d="M5 7.5 10 12.5 15 7.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path
        d="M12 5 7 10l5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ChevronRightIcon() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4" aria-hidden="true">
      <path
        d="m8 5 5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CampusArt() {
  return (
    <svg viewBox="0 0 160 78" className="mx-auto h-16 w-32" aria-hidden="true">
      <ellipse cx="80" cy="70" rx="58" ry="6" fill="#E7F6EA" />
      <rect x="52" y="36" width="56" height="30" rx="3" fill="#D7EBFF" />
      <path d="M46 38 80 16l34 22" fill="#7EB6FF" />
      <rect x="74" y="48" width="12" height="18" rx="1.5" fill="#5B9DFF" />
      <rect x="58" y="44" width="9" height="7" rx="1" fill="#fff" />
      <rect x="93" y="44" width="9" height="7" rx="1" fill="#fff" />
      <circle cx="28" cy="52" r="9" fill="#86EFAC" />
      <rect x="26" y="52" width="4" height="16" rx="1" fill="#94A978" />
      <circle cx="132" cy="54" r="8" fill="#4ADE80" />
      <rect x="130" y="54" width="4" height="14" rx="1" fill="#94A978" />
    </svg>
  );
}

