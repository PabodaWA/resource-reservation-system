
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Resource = {
  id: string;
  name: string;
  type: string;
  location: string;
  capacity: number;
  description: string | null;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
};

const emptyForm = {
  name: "",
  type: "MEETING_ROOM",
  location: "",
  capacity: "1",
  description: "",
};

export default function Home() {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");

  const loadResources = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/resources");
      const data: unknown = await response.json();

      if (!response.ok) {
        throw new Error("Unable to load resources.");
      }

      if (!Array.isArray(data)) {
        throw new Error("Unexpected response from the resources API.");
      }

      setResources(data as Resource[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadResources();
  }, [loadResources]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess("");

    const capacity = Number(form.capacity);

    if (!Number.isInteger(capacity) || capacity < 1) {
      setError("Capacity must be a positive whole number.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          type: form.type,
          location: form.location,
          capacity,
          description: form.description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Unable to create the resource."
        );
      }

      setForm(emptyForm);
      setShowForm(false);
      setSuccess("Resource created successfully.");
      await loadResources();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setSaving(false);
    }
  }

  const filteredResources = resources.filter((resource) => {
    const term = search.toLowerCase();

    return (
      resource.name.toLowerCase().includes(term) ||
      resource.type.toLowerCase().includes(term) ||
      resource.location.toLowerCase().includes(term)
    );
  });

  const activeCount = resources.filter(
    (resource) => resource.status === "ACTIVE"
  ).length;

  const totalCapacity = resources.reduce(
    (total, resource) => total + resource.capacity,
    0
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white p-6 md:flex">
          <a href="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-xl font-bold text-white">
              R
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight">
                ReserveFlow
              </h1>
              <p className="text-xs text-slate-500">
                Resource management
              </p>
            </div>
          </a>

          <p className="mb-3 mt-10 text-xs font-semibold uppercase tracking-widest text-slate-400">
            Workspace
          </p>

          <nav className="space-y-2">
            <a
              href="#dashboard"
              className="flex items-center gap-3 rounded-xl bg-indigo-50 px-4 py-3 font-semibold text-indigo-700"
            >
              <span>▦</span> Dashboard
            </a>
            <a
              href="#resources"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 transition hover:bg-slate-100"
            >
              <span>▤</span> Resources
            </a>
            <a
              href="#reservations"
              className="flex items-center gap-3 rounded-xl px-4 py-3 text-slate-600 transition hover:bg-slate-100"
            >
              <span>▣</span> Reservations
            </a>
          </nav>

          <div className="mt-auto rounded-2xl bg-slate-50 p-4">
            <p className="font-semibold text-slate-800">
              Resource overview
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Manage shared spaces and keep resource information organized.
            </p>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-indigo-600"
                style={{
                  width: `${
                    resources.length
                      ? (activeCount / resources.length) * 100
                      : 0
                  }%`,
                }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-500">
              {activeCount} of {resources.length} resources active
            </p>
          </div>
        </aside>

        <main id="dashboard" className="min-w-0 flex-1">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 bg-white px-5 py-5 sm:px-8">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 font-bold text-white md:hidden">
                R
              </div>
              <div>
                <p className="text-sm text-slate-500">
                  Workspace / Overview
                </p>
                <h2 className="mt-1 text-xl font-bold sm:text-2xl">
                  Dashboard
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="hidden text-right sm:block">
                <p className="text-sm font-semibold">Resource Manager</p>
                <p className="text-xs text-slate-500">
                  Management workspace
                </p>
              </div>
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 font-bold text-indigo-700">
                RM
              </div>
            </div>
          </header>

          <div className="mx-auto max-w-7xl space-y-8 p-5 sm:p-8">
            <section className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-indigo-700 to-violet-600 p-6 text-white shadow-sm sm:p-9">
              <div className="relative z-10 max-w-xl">
                <p className="text-sm font-medium text-indigo-100">
                  RESOURCE MANAGEMENT
                </p>
                <h3 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                  Everything in one place.
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-6 text-indigo-100 sm:text-base">
                  Manage shared resources, monitor capacity, and keep your
                  workspace organized.
                </p>
                <button
                  onClick={() => {
                    setError("");
                    setSuccess("");
                    setShowForm(true);
                  }}
                  className="mt-6 rounded-xl bg-white px-5 py-3 text-sm font-semibold text-indigo-700 shadow-sm transition hover:bg-indigo-50"
                >
                  + Add new resource
                </button>
              </div>
              <div className="pointer-events-none absolute -right-8 -top-20 h-64 w-64 rounded-full border-[35px] border-white/10" />
              <div className="pointer-events-none absolute -bottom-24 right-36 h-48 w-48 rounded-full bg-white/10" />
            </section>

            {error && (
              <div
                role="alert"
                className="flex items-start justify-between gap-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
              >
                <p>{error}</p>
                <button
                  onClick={() => setError("")}
                  aria-label="Dismiss error"
                >
                  ✕
                </button>
              </div>
            )}

            {success && (
              <div
                role="status"
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              >
                ✓ {success}
              </div>
            )}

            <section aria-label="Resource statistics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <StatCard
                label="Total resources"
                value={loading ? "—" : resources.length}
                detail="Registered in the system"
                icon="▤"
                color="indigo"
              />
              <StatCard
                label="Active resources"
                value={loading ? "—" : activeCount}
                detail="Currently marked active"
                icon="✓"
                color="emerald"
              />
              <StatCard
                label="Total capacity"
                value={loading ? "—" : totalCapacity}
                detail="Combined resource capacity"
                icon="♙"
                color="amber"
              />
            </section>

            {showForm && (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
                <div className="mb-6 flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold">Add a resource</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Enter the details of the shared resource.
                    </p>
                  </div>
                  <button
                    onClick={() => setShowForm(false)}
                    className="rounded-lg px-3 py-2 text-slate-500 hover:bg-slate-100"
                    aria-label="Close form"
                  >
                    ✕
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <FormField label="Resource name">
                      <input
                        required
                        maxLength={100}
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        placeholder="e.g. Conference Room A"
                        className={inputClass}
                      />
                    </FormField>

                    <FormField label="Resource type">
                      <select
                        value={form.type}
                        onChange={(e) =>
                          setForm({ ...form, type: e.target.value })
                        }
                        className={inputClass}
                      >
                        <option value="MEETING_ROOM">Meeting room</option>
                        <option value="CONFERENCE_ROOM">Conference room</option>
                        <option value="DESK">Desk</option>
                        <option value="PROJECTOR">Projector</option>
                        <option value="VEHICLE">Vehicle</option>
                        <option value="OTHER">Other</option>
                      </select>
                    </FormField>

                    <FormField label="Location">
                      <input
                        required
                        maxLength={150}
                        value={form.location}
                        onChange={(e) =>
                          setForm({ ...form, location: e.target.value })
                        }
                        placeholder="e.g. Floor 2"
                        className={inputClass}
                      />
                    </FormField>

                    <FormField label="Capacity">
                      <input
                        required
                        type="number"
                        min="1"
                        step="1"
                        value={form.capacity}
                        onChange={(e) =>
                          setForm({ ...form, capacity: e.target.value })
                        }
                        className={inputClass}
                      />
                    </FormField>
                  </div>

                  <FormField label="Description (optional)">
                    <textarea
                      rows={3}
                      maxLength={500}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      placeholder="Add useful details about this resource..."
                      className={inputClass}
                    />
                  </FormField>

                  <div className="flex flex-wrap justify-end gap-3 border-t border-slate-100 pt-5">
                    <button
                      type="button"
                      onClick={() => setShowForm(false)}
                      className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {saving ? "Saving..." : "Save resource"}
                    </button>
                  </div>
                </form>
              </section>
            )}

            <section
              id="resources"
              className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
            >
              <div className="flex flex-col gap-4 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
                <div>
                  <h3 className="text-lg font-bold">All resources</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    View and manage your registered resources.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    type="search"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search resources..."
                    aria-label="Search resources"
                    className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 sm:w-56"
                  />
                  <button
                    onClick={() => void loadResources()}
                    disabled={loading}
                    className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50"
                  >
                    ↻ Refresh
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="p-12 text-center">
                  <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600" />
                  <p className="mt-4 text-sm text-slate-500">
                    Loading resources...
                  </p>
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="px-6 py-16 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-2xl text-slate-500">
                    ▤
                  </div>
                  <h4 className="mt-4 font-semibold">
                    {resources.length === 0
                      ? "No resources yet"
                      : "No matching resources"}
                  </h4>
                  <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                    {resources.length === 0
                      ? "Add your first resource to start organizing your shared workspace."
                      : "Try another search term or clear your search."}
                  </p>
                  {resources.length === 0 && (
                    <button
                      onClick={() => setShowForm(true)}
                      className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                      + Add your first resource
                    </button>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-6 py-4 font-semibold">Resource</th>
                        <th className="px-6 py-4 font-semibold">Type</th>
                        <th className="px-6 py-4 font-semibold">Location</th>
                        <th className="px-6 py-4 font-semibold">Capacity</th>
                        <th className="px-6 py-4 font-semibold">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filteredResources.map((resource) => (
                        <tr
                          key={resource.id}
                          className="transition hover:bg-slate-50/70"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 font-semibold text-indigo-700">
                                {resource.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-800">
                                  {resource.name}
                                </p>
                                <p className="mt-1 max-w-56 truncate text-xs text-slate-500">
                                  {resource.description || "No description"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {resource.type.replaceAll("_", " ")}
                          </td>
                          <td className="px-6 py-4 text-slate-600">
                            {resource.location}
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-700">
                            {resource.capacity}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
                                resource.status === "ACTIVE"
                                  ? "bg-emerald-50 text-emerald-700"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {resource.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4 text-xs text-slate-500 sm:px-6">
                <span>
                  Showing {filteredResources.length} of {resources.length} resources
                </span>
                <span>Data is loaded from your database</span>
              </div>
            </section>

            <section
              id="reservations"
              className="rounded-2xl border border-dashed border-slate-300 bg-white p-6 sm:p-8"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
                    Coming next
                  </p>
                  <h3 className="mt-2 text-lg font-bold">
                    Reservation management
                  </h3>
                  <p className="mt-2 max-w-xl text-sm leading-6 text-slate-500">
                    The next module will let users create and manage bookings
                    with date, time, and resource availability validation.
                  </p>
                </div>
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600">
                  ▣
                </div>
              </div>
            </section>

            <footer className="pb-2 text-center text-xs text-slate-400">
              ReserveFlow · Resource Reservation Management System
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100";

function FormField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold text-slate-700">{label}</span>
      {children}
    </label>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
  color,
}: {
  label: string;
  value: string | number;
  detail: string;
  icon: string;
  color: "indigo" | "emerald" | "amber";
}) {
  const colors = {
    indigo: "bg-indigo-50 text-indigo-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div
          className={`flex h-11 w-11 items-center justify-center rounded-xl text-xl font-bold ${colors[color]}`}
        >
          {icon}
        </div>
      </div>
      <p className="mt-4 text-xs text-slate-500">{detail}</p>
    </div>
  );
}
