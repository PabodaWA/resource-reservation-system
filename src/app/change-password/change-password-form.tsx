
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";

export default function ChangePasswordPage({
  required,
  homeHref,
}: {
  required: boolean;
  homeHref: string;
}) {
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("New password must contain 12–128 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setError("Choose a different password.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      const data: { message?: string; role?: string } = await response.json();

      if (!response.ok) {
        setError(
          data.message ?? "Unable to change your password."
        );
        return;
      }

      setSuccess("Password changed successfully. Redirecting...");

      router.replace(homeHref);
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6">
        <ThemeToggle />
      </div>
      <section className="w-full max-w-md rounded-2xl bg-white p-8 shadow-lg">
        <div className="mb-7 text-center">
          <img
            src="/R%20logo.jpg"
            alt="Ruhunu ResourceHub"
            className="mx-auto mb-4 h-16 w-16 rounded-xl object-contain"
          />

          <h1 className="text-2xl font-bold text-slate-900">
            Change Your Password
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            {required
              ? "For your account security, set a new password before continuing to Ruhunu ResourceHub."
              : "Enter your current password, then choose a new one."}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="currentPassword"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Current Password
            </label>

            <input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) =>
                setCurrentPassword(event.target.value)
              }
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="newPassword"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              New Password
            </label>

            <input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={newPassword}
              onChange={(event) =>
                setNewPassword(event.target.value)
              }
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />

            <p className="mt-1 text-xs text-slate-500">
              Use 12–128 characters.
            </p>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-2 block text-sm font-medium text-slate-700"
            >
              Confirm New Password
            </label>

            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={confirmPassword}
              onChange={(event) =>
                setConfirmPassword(event.target.value)
              }
              required
              disabled={isLoading}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-slate-100"
            />
          </div>

          {error && (
            <p
              role="alert"
              aria-live="polite"
              className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {error}
            </p>
          )}

          {success && (
            <p
              role="status"
              aria-live="polite"
              className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-700"
            >
              {success}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Updating Password..." : "Update Password"}
          </button>

          {!required && (
            <button
              type="button"
              disabled={isLoading}
              onClick={() => router.push(homeHref)}
              className="w-full rounded-lg border border-slate-300 px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Cancel
            </button>
          )}
        </form>

        <p className="mt-6 text-center text-xs text-slate-500">
          Ruhunu ResourceHub · Resource Reservation Management System
        </p>
      </section>
    </main>
  );
}
