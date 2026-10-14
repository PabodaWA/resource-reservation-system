"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ForgotPasswordPanel from "./forgot-password-panel";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

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
    <main
      className="relative min-h-dvh overflow-x-hidden bg-[#d7e7f5] text-slate-900"
      style={{ colorScheme: "light" }}
    >
      <img
        src="/login1.png"
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
      />
      <div className="absolute top-6 left-6 z-10 flex items-center gap-3.5 sm:top-8 sm:left-8">
        <img
          src="/R%20logo.jpg"
          alt=""
          className="h-14 w-14 rounded-2xl bg-white object-contain p-1 shadow-sm ring-1 ring-[#d5e6fb]"
        />
        <div className="leading-tight">
          <p className="text-[1.35rem] font-bold tracking-tight text-[#0c2d6b]">
            Ruhunu ResourceHub
          </p>
          <p className="mt-0.5 text-sm font-medium tracking-wide text-[#3d6294]">
            Resource Reservation System
          </p>
        </div>
      </div>
      <div className="relative flex min-h-dvh items-center justify-end px-4 py-6 sm:px-8 lg:pr-[calc(6rem+3cm)] xl:pr-[calc(8rem+3cm)]">
        <section className="my-auto w-full max-w-[calc(520px+4cm)]">
          <div className="w-full rounded-[28px] bg-white px-9 pt-[calc(1rem+1cm)] pb-[calc(2.25rem+2cm)] shadow-[0_24px_70px_rgba(16,42,84,0.18)]">
            {showForgotPassword ? (
              <ForgotPasswordPanel
                initialEmail={email}
                onBack={() => {
                  setShowForgotPassword(false);
                  setError("");
                }}
                onComplete={(resetEmail) => {
                  setEmail(resetEmail);
                  setPassword("");
                  setError("");
                  setNotice(
                    "Password updated. Sign in with your new password."
                  );
                  setShowForgotPassword(false);
                }}
              />
            ) : (
            <>
            <div>
              <h3 className="text-[2.85rem] leading-[1.05] font-bold tracking-tight text-[#10284f]">
                Sign In To Your Account
              </h3>  
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-[1.15rem] font-semibold text-slate-800">
                  Email Address
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-6 flex items-center text-slate-400">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                      <rect x="3.5" y="5.5" width="17" height="13" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="m4.5 7 7.5 6 7.5-6" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                  <input
                    id="email"
                    type="email"
                    required
                    autoComplete="username"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="Enter your email"
                    disabled={isLoading}
                    className="h-16 w-full rounded-2xl border border-slate-200 bg-white pr-6 pl-16 text-[1.15rem] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/15 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="password" className="mb-1.5 block text-[1.15rem] font-semibold text-slate-800">
                  Password
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-6 flex items-center text-slate-400">
                    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                      <rect x="5" y="10.5" width="14" height="9" rx="2" stroke="currentColor" strokeWidth="1.7" />
                      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    className="h-16 w-full rounded-2xl border border-slate-200 bg-white pr-14 pl-16 text-[1.15rem] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/15 disabled:bg-slate-50"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    disabled={isLoading}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-5 flex items-center text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? (
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                        <path d="M4 4l16 16M9.9 9.9A3 3 0 0 0 12 15a3 3 0 0 0 2.1-.9M6.1 6.7C4.2 8.1 2.8 10 2 12c1.6 4 5.3 7 10 7 1.7 0 3.3-.4 4.7-1.1M10.6 5.2A10 10 0 0 1 12 5c4.7 0 8.4 3 10 7a12 12 0 0 1-2.2 3.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                      </svg>
                    ) : (
                      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden="true">
                        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" stroke="currentColor" strokeWidth="1.7" />
                        <circle cx="12" cy="12" r="2.5" stroke="currentColor" strokeWidth="1.7" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <label className="flex cursor-pointer items-center gap-2 text-[1.15rem] text-slate-600">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                    disabled={isLoading}
                    className="h-5 w-5 rounded border-slate-300 accent-[#2563eb]"
                  />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setNotice("");
                    setShowForgotPassword(true);
                  }}
                  className="text-[1.15rem] font-medium text-[#2f6bff] hover:text-[#1d4ed8]"
                >
                  Forgot password?
                </button>
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-[1.15rem] text-red-700">
                  {error}
                </p>
              )}

              {notice && (
                <p role="status" className="rounded-xl bg-[#e7f1ff] px-3 py-2 text-[1.15rem] text-[#12356b]">
                  {notice}
                </p>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex h-16 w-full items-center justify-center gap-3 rounded-2xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-[1.15rem] font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-[#2f74ea] hover:to-[#1d4fd7] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="mt-6 text-center text-[1.15rem] text-slate-500">
              Don&apos;t have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setNotice("");
                  setError(
                    "Ask an administrator to create an account for you. Email - adminruhunurh@gmail.com"
                  );
                }}
                className="font-semibold text-[#2f6bff] hover:text-[#1d4ed8]"
              >
                Contact your administrator.
              </button>
            </p>
            </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
