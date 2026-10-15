"use client";

import { useState } from "react";
import { resourcePhoto, visualKind, type Section, type VisualKind } from "./model";

export function NoteIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M7 3.5h7l5 5V20a1.5 1.5 0 0 1-1.5 1.5h-10.5A1.5 1.5 0 0 1 5.5 20V5A1.5 1.5 0 0 1 7 3.5z" />
      <path d="M14 3.5V9h5.5M8 13h8M8 17h6" />
    </svg>
  );
}

export function GalleryFrame({
  src,
  resource,
  className,
}: {
  src: string;
  resource: { category: string; subcategory: string; name: string; location: string };
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed || !src) {
    return <ResourceVisual resource={resource} className={className} />;
  }

  return (
    <img
      src={src}
      alt=""
      onError={() => setFailed(true)}
      className={`object-cover ${className ?? "h-40 w-full"}`}
    />
  );
}

export function SearchMark() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function BoltGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M13 3 5 14h6l-1 7 8-11h-6z" />
    </svg>
  );
}

export function ResourcePhoto({
  resource,
  className,
}: {
  resource: {
    category: string;
    subcategory: string;
    name: string;
    location: string;
    images?: string[];
  };
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <ResourceVisual resource={resource} className={className} />;
  }

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-slate-100 ${className ?? "h-14 w-16"}`}
    >
      <img
        src={resourcePhoto(resource)}
        alt=""
        onError={() => setFailed(true)}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

export function ResourceVisual({
  resource,
  className,
}: {
  resource: { category: string; subcategory: string; name: string; location: string };
  className?: string;
}) {
  const kind = visualKind(resource);

  return (
    <div
      className={`relative shrink-0 overflow-hidden bg-gradient-to-br ${kind.gradient} ${className ?? "h-14 w-16"}`}
    >
      <ResourceScene kind={kind.id} />
    </div>
  );
}

export function ResourceScene({ kind }: { kind: VisualKind }) {
  if (kind === "projector") {
    return (
      <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
        <rect x="8" y="18" width="46" height="22" rx="4" fill="#f8fafc" />
        <circle cx="28" cy="29" r="7" fill="#94a3b8" />
        <circle cx="28" cy="29" r="3" fill="#e2e8f0" />
        <rect x="50" y="24" width="10" height="8" rx="1" fill="#cbd5e1" />
      </svg>
    );
  }

  if (kind === "laptop") {
    return (
      <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
        <rect x="18" y="12" width="40" height="26" rx="2" fill="#0f172a" />
        <rect x="21" y="15" width="34" height="20" fill="#38bdf8" />
        <path d="M12 40h56l-6 6H18z" fill="#cbd5e1" />
      </svg>
    );
  }

  if (kind === "lab") {
    return (
      <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
        <rect x="6" y="28" width="16" height="16" rx="1" fill="#1e293b" />
        <rect x="26" y="22" width="16" height="22" rx="1" fill="#0f172a" />
        <rect x="46" y="26" width="16" height="18" rx="1" fill="#1e293b" />
        <rect x="8" y="30" width="12" height="8" fill="#38bdf8" />
        <rect x="28" y="24" width="12" height="10" fill="#22d3ee" />
        <rect x="48" y="28" width="12" height="8" fill="#60a5fa" />
      </svg>
    );
  }

  if (kind === "hall") {
    return (
      <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
        <rect x="8" y="16" width="64" height="28" rx="2" fill="#fff7ed" />
        {Array.from({ length: 4 }, (_, row) =>
          Array.from({ length: 6 }, (_, col) => (
            <rect
              key={`${row}-${col}`}
              x={14 + col * 9}
              y={20 + row * 6}
              width="6"
              height="3"
              rx="0.5"
              fill="#fb923c"
            />
          ))
        )}
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 80 56" className="h-full w-full" aria-hidden="true">
      <rect x="6" y="10" width="68" height="36" rx="3" fill="#dbeafe" />
      <rect x="10" y="14" width="40" height="22" rx="1" fill="#93c5fd" />
      <rect x="54" y="18" width="14" height="18" rx="1" fill="#bfdbfe" />
      <rect x="14" y="38" width="10" height="6" rx="1" fill="#64748b" />
      <rect x="28" y="38" width="10" height="6" rx="1" fill="#64748b" />
    </svg>
  );
}

export function NavIcon({
  id,
  active = false,
}: {
  id: Section | "admin" | "favourites";
  active?: boolean;
}) {
  const className = `h-[18px] w-[18px] ${active ? "text-[#2f6fed]" : "text-slate-400"}`;

  if (id === "favourites") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M12 20s-7-4.4-7-9a4 4 0 0 1 7-2 4 4 0 0 1 7 2c0 4.6-7 9-7 9z" />
      </svg>
    );
  }

  if (id === "book") {
    return <LayersGlyph className={className} />;
  }

  if (id === "reservations") {
    return <CalendarGlyph className={className} />;
  }

  if (id === "notifications") {
    return <BellIcon className={className} />;
  }

  if (id === "profile" || id === "admin") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <circle cx="12" cy="8" r="3.2" />
        <path d="M5.5 19.5c1.4-3 3.6-4.5 6.5-4.5s5.1 1.5 6.5 4.5" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1z" />
    </svg>
  );
}

export function CategoryIcon({ id }: { id: string }) {
  const className = "h-8 w-8";

  if (id === "MEETING_ROOMS" || id === "all") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M6 21V5.5A1.5 1.5 0 0 1 7.5 4h9A1.5 1.5 0 0 1 18 5.5V21" />
        <path d="M6 21h12" />
        <circle cx="15.2" cy="12" r="0.8" fill="currentColor" stroke="none" />
      </svg>
    );
  }

  if (id === "SHARED_WORKSPACES" || id === "SHARED_EQUIPMENT") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <rect x="3" y="4" width="18" height="12" rx="1.6" />
        <path d="M8 20h8M12 16v4" />
      </svg>
    );
  }

  if (id === "COMPANY_VEHICLES") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
        <path d="M4 15h16l-1.2-4.2A2 2 0 0 0 16.9 9H7.1a2 2 0 0 0-1.9 1.8z" />
        <path d="M6.5 15v2.2M17.5 15v2.2" />
        <circle cx="7.5" cy="17.2" r="1.3" />
        <circle cx="16.5" cy="17.2" r="1.3" />
      </svg>
    );
  }

  return <PeopleIcon className={className} />;
}

export function PeopleIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="9" cy="8" r="2.3" />
      <circle cx="16" cy="9" r="1.8" />
      <path d="M4.2 18.2c.9-2.5 2.7-3.7 4.8-3.7s3.9 1.2 4.8 3.7" />
      <path d="M14 14.8c1.5-.5 3-.2 4.2.9.8.8 1.3 1.7 1.6 2.5" />
    </svg>
  );
}

export function PinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M12 21s6-5.1 6-10a6 6 0 1 0-12 0c0 4.9 6 10 6 10z" />
      <circle cx="12" cy="11" r="1.8" />
    </svg>
  );
}

export function BoxIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="m12 3 8 4-8 4-8-4z" />
      <path d="M4 7v8l8 4 8-4V7" />
      <path d="M12 11v8" />
    </svg>
  );
}

export function SortIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4 text-[#3b82f6]" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M8 6v12M8 6 5.5 8.5M8 6l2.5 2.5M16 18V6M16 18l-2.5-2.5M16 18l2.5-2.5" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function BellIcon({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="M6 16.5h12l-1.2-2V10a4.8 4.8 0 0 0-9.6 0v4.5z" />
      <path d="M10 18.5a2 2 0 0 0 4 0" />
    </svg>
  );
}

export function CalendarGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

export function ClockGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

export function CheckGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <circle cx="12" cy="12" r="8" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  );
}

export function StarGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m12 4 2.1 4.4 4.9.7-3.5 3.4.8 4.8L12 15.8 7.7 17.3l.8-4.8L5 9.1l4.9-.7z" />
    </svg>
  );
}

export function LayersGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path d="m12 4 8 4-8 4-8-4z" />
      <path d="m4 12 8 4 8-4" />
      <path d="m4 16 8 4 8-4" />
    </svg>
  );
}

export function SharedResourcesArt() {
  return (
    <svg viewBox="0 0 180 120" className="mx-auto h-28 w-40" aria-hidden="true">
      <ellipse cx="90" cy="104" rx="58" ry="8" fill="#e8eef6" />
      <path d="M48 78V52l42-24 42 24v26" fill="#f8fbff" stroke="#93c5fd" strokeWidth="2" />
      <path d="M70 78V58h20v20" fill="#dbeafe" stroke="#60a5fa" strokeWidth="2" />
      <path d="M36 86c8-16 14-16 18 0" fill="#86efac" />
      <path d="M28 90c6-12 12-12 16 0" fill="#4ade80" />
      <rect x="40" y="72" width="3" height="16" rx="1" fill="#65a30d" />
      <path d="M124 84c10-18 18-16 22 2" fill="#86efac" />
      <path d="M136 90c8-14 14-12 16 2" fill="#4ade80" />
      <rect x="132" y="74" width="3" height="16" rx="1" fill="#65a30d" />
      <circle cx="58" cy="46" r="6" fill="#bfdbfe" />
      <rect x="108" y="40" width="10" height="8" rx="1" fill="#93c5fd" />
    </svg>
  );
}

export function CalendarIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5 text-blue-600"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <rect x="3.5" y="5" width="17" height="15" rx="2" />
      <path d="M8 3.5v3M16 3.5v3M3.5 10h17" />
    </svg>
  );
}

export function ChevronIcon({
  direction,
}: {
  direction: "left" | "right" | "down";
}) {
  const path =
    direction === "left"
      ? "M14.5 6.5 9 12l5.5 5.5"
      : direction === "down"
        ? "M6.5 9.5 12 15l5.5-5.5"
        : "M9.5 6.5 15 12l-5.5 5.5";

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d={path} />
    </svg>
  );
}

export function PencilGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20h4l10.5-10.5a1.4 1.4 0 0 0 0-2L16.5 5.5a1.4 1.4 0 0 0-2 0L4 16z" />
      <path d="M13.5 6.5l4 4" />
    </svg>
  );
}

export function EyeGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M2.5 12S6 6.5 12 6.5 21.5 12 21.5 12 18 17.5 12 17.5 2.5 12 2.5 12z" />
      <circle cx="12" cy="12" r="2.5" />
    </svg>
  );
}

export function TrashGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M5 7h14" />
      <path d="M9 7V5.5A1.5 1.5 0 0 1 10.5 4h3A1.5 1.5 0 0 1 15 5.5V7" />
      <path d="M7 7l.8 12.2A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.3L17 7" />
    </svg>
  );
}

export function CrossGlyph({ className = "h-5 w-5" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </svg>
  );
}

export function InfoGlyph() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 11v5" />
      <path d="M12 8h.01" />
    </svg>
  );
}

