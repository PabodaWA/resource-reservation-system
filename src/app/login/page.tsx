"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
          rememberMe,
        }),
      });

      const data: {
        message?: string;
        requiresPasswordChange?: boolean;
        user?: { role?: string };
      } = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to sign in. Please try again.");
        return;
      }

      if (data.requiresPasswordChange) {
        router.replace("/change-password");
        return;
      }

      router.replace(data.user?.role === "ADMIN" ? "/admin" : "/");
      router.refresh();
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen w-full bg-[#f4f9fc] font-sans text-slate-900">
      <div className="relative hidden overflow-hidden lg:block lg:w-5/12">
        <img
          src="/bg3.png"
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-center"
        />
      </div>

      <div className="flex w-full items-center justify-center bg-[#f4f9fc] p-6 sm:p-12 lg:w-7/12">
        <div className="w-full max-w-xl space-y-8">
          <div className="flex items-center gap-3">
            <img
              src="/R%20logo.jpg"
              alt=""
              className="h-16 w-16 shrink-0 rounded-xl object-contain"
            />
            <span className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
              Ruhunu ResourceHub{" "}
              <span className="rounded-full border border-[#b7dff0] bg-[#e7f5fb] px-3 py-1 text-base font-semibold text-[#0874a8]">
                Workspace
              </span>
            </span>
          </div>

          <div>
            <h2 className="text-5xl font-bold tracking-tight text-slate-900">
              Sign in to portal
            </h2>
            <p className="mt-3 text-lg text-slate-500">
              Welcome back. Enter the email and password for your account.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-base font-bold tracking-wider text-slate-700 uppercase"
              >
                Work email address
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="name@company.com"
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-lg transition-all outline-none focus:border-transparent focus:ring-2 focus:ring-[#0c8ec8] disabled:bg-slate-50"
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label
                  htmlFor="password"
                  className="block text-base font-bold tracking-wider text-slate-700 uppercase"
                >
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice(
                      "Password reset is handled by an administrator."
                    );
                  }}
                  className="text-base font-semibold text-[#0874a8] transition-colors hover:text-[#005888]"
                >
                  Forgot password?
                </button>
              </div>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                disabled={isLoading}
                className="w-full rounded-xl border border-slate-200 bg-white px-5 py-4 text-lg transition-all outline-none focus:border-transparent focus:ring-2 focus:ring-[#0c8ec8] disabled:bg-slate-50"
              />
            </div>

            <div className="flex items-center justify-between">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(event) => setRememberMe(event.target.checked)}
                  disabled={isLoading}
                  className="h-5 w-5 rounded border-slate-300 text-[#0874a8] focus:ring-[#0c8ec8]"
                />
                <span className="text-lg font-medium text-slate-600">
                  Remember this device
                </span>
              </label>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl bg-red-50 px-4 py-3 text-lg text-red-700"
              >
                {error}
              </p>
            )}

            {notice && (
              <p
                role="status"
                className="rounded-xl bg-[#e7f5fb] px-4 py-3 text-lg text-[#065a86]"
              >
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-xl bg-[#0c8ec8] py-4 text-lg font-semibold text-white shadow-md shadow-[#0c8ec8]/20 transition-all duration-200 hover:bg-[#0874a8] hover:shadow-lg hover:shadow-[#0874a8]/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in to portal"}
            </button>
          </form>

          <div className="flex items-center justify-center gap-2 border-t border-slate-100 pt-4 text-base text-slate-400">
            <svg
              className="h-5 w-5 text-emerald-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
            <span>Sign in with your Ruhunu ResourceHub account</span>
          </div>
        </div>
      </div>
    </div>
  );
}
