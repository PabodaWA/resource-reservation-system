
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();
    setError("");
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
    <main className="relative flex min-h-screen items-center overflow-hidden bg-[#fbf8fd]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 -left-24 h-80 w-80 rounded-full bg-[#eadcf8]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[18%] -left-20 h-44 w-96 rotate-[-18deg] rounded-[50%] bg-[#f3e7fb]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-[-12%] bottom-[-22%] h-[460px] w-[560px] rounded-[46%] bg-[#e8d6f6]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[12%] right-[6%] h-52 w-80 rotate-12 rounded-[48%] bg-[#f6eefb]"
      />

      <div className="relative z-10 grid w-full items-center gap-4 px-6 py-10 lg:grid-cols-2 lg:px-14 xl:px-20">
        <div className="flex items-center justify-center">
          <img
            src="/loginbackground.jpg"
            alt="Team planning shared resources on a reservation dashboard"
            className="h-auto w-full max-w-xl object-contain"
          />
        </div>

        <div className="flex items-center justify-center">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-xs space-y-4"
          >
            <h1 className="pb-2 text-center text-[1.7rem] font-bold tracking-[0.22em] text-[#6d28d9]">
              WELCOME!
            </h1>

            <div>
              <label htmlFor="email" className="sr-only">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="Email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                disabled={isLoading}
                className="w-full rounded-full border border-[#d8c4ea] bg-white px-5 py-3 text-[15px] text-[#3d2463] outline-none transition placeholder:text-[#b7a4c8] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#8b5cf6]/15 disabled:bg-[#faf7fc]"
              />
            </div>

            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                disabled={isLoading}
                className="w-full rounded-full border border-[#d8c4ea] bg-white px-5 py-3 text-[15px] text-[#3d2463] outline-none transition placeholder:text-[#b7a4c8] focus:border-[#8b5cf6] focus:ring-4 focus:ring-[#8b5cf6]/15 disabled:bg-[#faf7fc]"
              />
            </div>

            {error && (
              <p
                role="alert"
                aria-live="polite"
                className="rounded-2xl bg-red-50 px-4 py-3 text-center text-sm text-red-700"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full rounded-full bg-[#7c3aed] px-5 py-3 text-[15px] font-semibold text-white shadow-[0_8px_20px_rgba(124,58,237,0.28)] transition hover:bg-[#6d28d9] focus:outline-none focus:ring-2 focus:ring-[#8b5cf6] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
