"use client";

import { useEffect, useState } from "react";

const inputClassName =
  "h-16 w-full rounded-2xl border border-slate-200 bg-white px-6 text-[1.15rem] text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#3b82f6] focus:ring-4 focus:ring-[#3b82f6]/15 disabled:bg-slate-50";

const primaryButtonClassName =
  "flex h-16 w-full items-center justify-center rounded-2xl bg-gradient-to-r from-[#3b82f6] to-[#2563eb] text-[1.15rem] font-semibold text-white shadow-lg shadow-blue-500/30 transition hover:from-[#2f74ea] hover:to-[#1d4fd7] disabled:cursor-not-allowed disabled:opacity-60";

type ForgotPasswordPanelProps = {
  initialEmail: string;
  onBack: () => void;
  onComplete: (email: string) => void;
};

type Step = "email" | "code" | "password";

function formatRemaining(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function ForgotPasswordPanel({
  initialEmail,
  onBack,
  onComplete,
}: ForgotPasswordPanelProps) {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState(initialEmail);
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  const [resendAt, setResendAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (step === "email") {
      return;
    }

    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(timer);
  }, [step]);

  const secondsLeft =
    expiresAt === null ? 0 : Math.max(0, Math.ceil((expiresAt - now) / 1000));
  const resendSecondsLeft =
    resendAt === null ? 0 : Math.max(0, Math.ceil((resendAt - now) / 1000));
  const codeExpired = step !== "email" && secondsLeft === 0;

  async function requestCode(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");
    setNotice("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });

      const data: {
        message?: string;
        expiresInSeconds?: number;
        retryAfterSeconds?: number;
      } = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to send the reset code.");
        if (response.status === 429 && data.retryAfterSeconds) {
          setResendAt(Date.now() + data.retryAfterSeconds * 1000);
        }
        return;
      }

      const sentAt = Date.now();
      setExpiresAt(sentAt + (data.expiresInSeconds ?? 300) * 1000);
      setResendAt(sentAt + 60 * 1000);
      setOtp("");
      setNewPassword("");
      setConfirmPassword("");
      setNow(sentAt);
      setStep("code");
      setNotice(
        data.message ??
          "A reset code was sent to that email. It expires in 5 minutes."
      );
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (codeExpired) {
      setError("This code has expired. Request a new one.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/verify-reset-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
        }),
      });

      const data: { message?: string } = await response.json();

      if (!response.ok) {
        setError(data.message ?? "That code is incorrect.");
        return;
      }

      setStep("password");
      setNotice(data.message ?? "Code verified. Choose a new password.");
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  async function resetPassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (codeExpired) {
      setError("This code has expired. Request a new one.");
      return;
    }

    if (newPassword.length < 12 || newPassword.length > 128) {
      setError("New password must contain 12–128 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("New password and confirmation do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          otp: otp.trim(),
          newPassword,
        }),
      });

      const data: { message?: string } = await response.json();

      if (!response.ok) {
        setError(data.message ?? "Unable to reset the password.");
        if (
          data.message?.includes("expired") ||
          data.message?.includes("invalid") ||
          data.message?.includes("incorrect") ||
          data.message?.includes("Request a new code")
        ) {
          setStep("code");
        }
        return;
      }

      onComplete(email.trim());
    } catch {
      setError("Unable to connect to the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  const intro =
    step === "email"
      ? "Enter the email address registered on this system. We will send a 6-digit code that expires in 5 minutes."
      : step === "code"
        ? "Enter the code from your email. A new password can be chosen only after that code is correct."
        : "That code is correct. Choose a new password before it expires.";

  return (
    <div>
      <h3 className="text-[2.85rem] leading-[1.05] font-bold tracking-tight text-[#10284f]">
        Reset your password
      </h3>
      <p className="mt-3 text-[1.05rem] leading-relaxed text-slate-500">
        {intro}
      </p>

      {step === "email" ? (
        <form onSubmit={requestCode} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="reset-email"
              className="mb-1.5 block text-[1.15rem] font-semibold text-slate-800"
            >
              Email Address
            </label>
            <input
              id="reset-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your registered email"
              disabled={isLoading}
              className={inputClassName}
            />
          </div>

          {error && <FormAlert>{error}</FormAlert>}

          <button
            type="submit"
            disabled={isLoading}
            className={primaryButtonClassName}
          >
            {isLoading ? "Sending code..." : "Send reset code"}
          </button>
        </form>
      ) : null}

      {step === "code" ? (
        <form onSubmit={verifyCode} className="mt-6 space-y-5">
          <CodeField
            otp={otp}
            onChange={setOtp}
            disabled={isLoading || codeExpired}
            codeExpired={codeExpired}
            secondsLeft={secondsLeft}
          />

          {error && <FormAlert>{error}</FormAlert>}
          {notice && <FormNotice>{notice}</FormNotice>}

          <button
            type="submit"
            disabled={isLoading || codeExpired}
            className={primaryButtonClassName}
          >
            {isLoading ? "Checking code..." : "Verify code"}
          </button>

          <ResendButton
            isLoading={isLoading}
            resendSecondsLeft={resendSecondsLeft}
            onClick={() => requestCode()}
          />
        </form>
      ) : null}

      {step === "password" ? (
        <form onSubmit={resetPassword} className="mt-6 space-y-5">
          <p
            className={`text-base ${codeExpired ? "text-red-700" : "text-slate-500"}`}
          >
            {codeExpired
              ? "This code has expired. Request a new one."
              : `Code verified. It expires in ${formatRemaining(secondsLeft)}.`}
          </p>

          <div>
            <label
              htmlFor="new-password"
              className="mb-1.5 block text-[1.15rem] font-semibold text-slate-800"
            >
              New password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                placeholder="At least 12 characters"
                disabled={isLoading || codeExpired}
                className={`${inputClassName} pr-16`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                disabled={isLoading}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute inset-y-0 right-5 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirm-password"
              className="mb-1.5 block text-[1.15rem] font-semibold text-slate-800"
            >
              Confirm new password
            </label>
            <input
              id="confirm-password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Re-enter the new password"
              disabled={isLoading || codeExpired}
              className={inputClassName}
            />
          </div>

          {error && <FormAlert>{error}</FormAlert>}
          {notice && <FormNotice>{notice}</FormNotice>}

          <button
            type="submit"
            disabled={isLoading || codeExpired}
            className={primaryButtonClassName}
          >
            {isLoading ? "Updating password..." : "Set new password"}
          </button>

          <ResendButton
            isLoading={isLoading}
            resendSecondsLeft={resendSecondsLeft}
            onClick={() => requestCode()}
          />
        </form>
      ) : null}

      <button
        type="button"
        onClick={onBack}
        className="mt-5 w-full text-center text-[1.05rem] font-medium text-slate-500 hover:text-slate-700"
      >
        Back to sign in
      </button>
    </div>
  );
}

function CodeField({
  otp,
  onChange,
  disabled,
  codeExpired,
  secondsLeft,
}: {
  otp: string;
  onChange: (value: string) => void;
  disabled: boolean;
  codeExpired: boolean;
  secondsLeft: number;
}) {
  return (
    <div>
      <label
        htmlFor="reset-otp"
        className="mb-1.5 block text-[1.15rem] font-semibold text-slate-800"
      >
        Reset code
      </label>
      <input
        id="reset-otp"
        inputMode="numeric"
        autoComplete="one-time-code"
        required
        maxLength={6}
        pattern="\d{6}"
        value={otp}
        onChange={(event) =>
          onChange(event.target.value.replaceAll(/\D/g, "").slice(0, 6))
        }
        placeholder="6-digit code"
        disabled={disabled}
        className={`${inputClassName} tracking-[0.3em]`}
      />
      <p
        className={`mt-2 text-base ${codeExpired ? "text-red-700" : "text-slate-500"}`}
      >
        {codeExpired
          ? "This code has expired. Request a new one."
          : `Code expires in ${formatRemaining(secondsLeft)}.`}
      </p>
    </div>
  );
}

function ResendButton({
  isLoading,
  resendSecondsLeft,
  onClick,
}: {
  isLoading: boolean;
  resendSecondsLeft: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading || resendSecondsLeft > 0}
      className="w-full text-center text-[1.05rem] font-medium text-[#2f6bff] hover:text-[#1d4ed8] disabled:cursor-not-allowed disabled:text-slate-400"
    >
      {resendSecondsLeft > 0
        ? `Request a new code in ${resendSecondsLeft}s`
        : "Request a new code"}
    </button>
  );
}

function FormAlert({ children }: { children: string }) {
  return (
    <p
      role="alert"
      className="rounded-xl bg-red-50 px-3 py-2 text-[1.15rem] text-red-700"
    >
      {children}
    </p>
  );
}

function FormNotice({ children }: { children: string }) {
  return (
    <p
      role="status"
      className="rounded-xl bg-[#e7f1ff] px-3 py-2 text-[1.15rem] text-[#12356b]"
    >
      {children}
    </p>
  );
}
