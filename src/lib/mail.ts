import type { Transporter } from "nodemailer";

type TemporaryPasswordEmail = {
  to: string;
  name: string;
  temporaryPassword: string;
  loginUrl: string;
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function isMailConfigured(): boolean {
  return Boolean(
    readEnv("SMTP_HOST") &&
      readEnv("SMTP_USER") &&
      readEnv("SMTP_PASS") &&
      readEnv("SMTP_FROM")
  );
}

export function appUrlFrom(request: Request): string {
  const configured = process.env.APP_URL?.trim();

  if (configured) {
    try {
      const base = new URL(configured);

      if (base.protocol === "http:" || base.protocol === "https:") {
        return new URL("/", base).toString();
      }
    } catch {
      // Fall back to the request origin when APP_URL is not a valid URL.
    }
  }

  return new URL("/", new URL(request.url).origin).toString();
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

type MailTransport = {
  from: string;
  transporter: Transporter;
};

let cachedMailTransport: MailTransport | null = null;
let cachedMailTransportKey = "";

function isTransientMailError(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return false;
  }

  return (
    typeof error.code === "string" &&
    ["ECONNRESET", "ECONNREFUSED", "ETIMEDOUT", "ESOCKET"].includes(error.code)
  );
}

async function sendMailWithRetry(
  transporter: Transporter,
  message: Parameters<Transporter["sendMail"]>[0]
) {
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      return await transporter.sendMail(message);
    } catch (error) {
      if (attempt === 2 || !isTransientMailError(error)) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  throw new Error("Email could not be sent.");
}

async function createTransporter() {
  const host = readEnv("SMTP_HOST");
  const user = readEnv("SMTP_USER");
  const pass = readEnv("SMTP_PASS");
  const from = readEnv("SMTP_FROM");
  const port = Number(readEnv("SMTP_PORT") || "587");

  if (!host || !user || !pass || !from) {
    throw new Error("SMTP mail settings are incomplete.");
  }

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_PORT is invalid.");
  }

  const transportKey = `${host}\0${port}\0${user}\0${pass}\0${from}`;
  if (cachedMailTransport && cachedMailTransportKey === transportKey) {
    return cachedMailTransport;
  }

  // Loaded here so this file stays a synchronous module. A top-level
  // nodemailer import makes Turbopack evaluate it asynchronously and the
  // participant notice export is then missing at call time.
  const { default: nodemailer } = await import("nodemailer");

  cachedMailTransport = {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      requireTLS: port === 587,
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      auth: { user, pass },
    }),
  };

  cachedMailTransportKey = transportKey;
  return cachedMailTransport;
}

type ParticipantNoticeEmail = {
  to: string;
  name: string;
  bookerName: string;
  resourceName: string;
  location: string;
  title: string;
  whenLabel: string;
  appUrl: string;
};

export async function sendParticipantNotice(
  input: ParticipantNoticeEmail
): Promise<void> {
  const { from, transporter } = await createTransporter();
  const safeName = escapeHtml(input.name);
  const safeBooker = escapeHtml(input.bookerName);
  const safeResource = escapeHtml(input.resourceName);
  const safeLocation = escapeHtml(input.location);
  const safeTitle = escapeHtml(input.title);
  const safeWhen = escapeHtml(input.whenLabel);
  const safeAppUrl = escapeHtml(input.appUrl);

  await sendMailWithRetry(transporter, {
    from,
    to: input.to,
    subject: `${input.bookerName} included you in a resource booking`,
    text: [
      `Hello ${input.name},`,
      "",
      `${input.bookerName} booked ${input.resourceName} and included you.`,
      "",
      `Title: ${input.title}`,
      `When: ${input.whenLabel}`,
      `Where: ${input.location}`,
      "",
      `Check the web application to see this reservation: ${input.appUrl}`,
    ].join("\n"),
    html: `
      <p>Hello ${safeName},</p>
      <p>${safeBooker} booked <strong>${safeResource}</strong> and included you.</p>
      <p>
        <strong>Title:</strong> ${safeTitle}<br />
        <strong>When:</strong> ${safeWhen}<br />
        <strong>Where:</strong> ${safeLocation}
      </p>
      <p>Check the web application to see this reservation: <a href="${safeAppUrl}">${safeAppUrl}</a></p>
    `,
  });
}

export async function sendParticipantCancellation(
  input: ParticipantNoticeEmail
): Promise<void> {
  const { from, transporter } = await createTransporter();
  const safeName = escapeHtml(input.name);
  const safeBooker = escapeHtml(input.bookerName);
  const safeResource = escapeHtml(input.resourceName);
  const safeLocation = escapeHtml(input.location);
  const safeTitle = escapeHtml(input.title);
  const safeWhen = escapeHtml(input.whenLabel);
  const safeAppUrl = escapeHtml(input.appUrl);

  await sendMailWithRetry(transporter, {
    from,
    to: input.to,
    subject: `A booking you were included in was cancelled`,
    text: [
      `Hello ${input.name},`,
      "",
      `The booking for ${input.resourceName} that ${input.bookerName} included you in has been cancelled.`,
      "",
      `Title: ${input.title}`,
      `When: ${input.whenLabel}`,
      `Where: ${input.location}`,
      "",
      `Check the web application to see this reservation: ${input.appUrl}`,
    ].join("\n"),
    html: `
      <p>Hello ${safeName},</p>
      <p>The booking for <strong>${safeResource}</strong> that ${safeBooker} included you in has been cancelled.</p>
      <p>
        <strong>Title:</strong> ${safeTitle}<br />
        <strong>When:</strong> ${safeWhen}<br />
        <strong>Where:</strong> ${safeLocation}
      </p>
      <p>Check the web application to see this reservation: <a href="${safeAppUrl}">${safeAppUrl}</a></p>
    `,
  });
}

type BookerReservationEmail = {
  to: string;
  name: string;
  resourceName: string;
  location: string;
  title: string;
  whenLabel: string;
  appUrl: string;
  outcome: "confirmed" | "pending" | "cancelled" | "declined";
  declineReason?: string;
};

export async function emailBooker(
  request: Request,
  input: Omit<BookerReservationEmail, "appUrl"> & { sentToActor: boolean }
): Promise<string> {
  const noun =
    input.outcome === "declined"
      ? "decline"
      : input.outcome === "cancelled"
        ? "cancellation"
        : "confirmation";

  if (!isMailConfigured()) {
    return input.sentToActor
      ? ` Your ${noun} email could not be sent.`
      : ` Their ${noun} email could not be sent.`;
  }

  try {
    await sendBookerReservationEmail({
      to: input.to,
      name: input.name,
      resourceName: input.resourceName,
      location: input.location,
      title: input.title,
      whenLabel: input.whenLabel,
      outcome: input.outcome,
      declineReason: input.declineReason,
      appUrl: appUrlFrom(request),
    });
  } catch (error) {
    console.error(`Failed to send ${noun} email:`, error);
    return input.sentToActor
      ? ` Your ${noun} email could not be sent.`
      : ` Their ${noun} email could not be sent.`;
  }

  return input.sentToActor
    ? ` A ${noun} email was sent to you.`
    : ` A ${noun} email was sent to the person who booked it.`;
}

export async function sendBookerReservationEmail(
  input: BookerReservationEmail
): Promise<void> {
  const { from, transporter } = await createTransporter();
  const safeName = escapeHtml(input.name);
  const safeResource = escapeHtml(input.resourceName);
  const safeLocation = escapeHtml(input.location);
  const safeTitle = escapeHtml(input.title);
  const safeWhen = escapeHtml(input.whenLabel);
  const safeAppUrl = escapeHtml(input.appUrl);
  const safeDeclineReason = input.declineReason
    ? escapeHtml(input.declineReason)
    : "";
  const copy =
    input.outcome === "pending"
      ? {
          subject: "Your resource booking is waiting for approval",
          lead: `Your booking for ${input.resourceName} was submitted and is waiting for approval.`,
          safeLead: `Your booking for <strong>${safeResource}</strong> was submitted and is waiting for approval.`,
        }
      : input.outcome === "cancelled"
        ? {
            subject: "Your resource booking was cancelled",
            lead: `Your booking for ${input.resourceName} was cancelled.`,
            safeLead: `Your booking for <strong>${safeResource}</strong> was cancelled.`,
          }
        : input.outcome === "declined"
          ? {
              subject: "Your resource booking request was declined",
              lead: `Your booking request for ${input.resourceName} was declined.${input.declineReason ? ` Reason: ${input.declineReason}` : ""}`,
              safeLead: `Your booking request for <strong>${safeResource}</strong> was declined.${input.declineReason ? ` Reason: ${safeDeclineReason}` : ""}`,
            }
          : {
              subject: "Your resource booking is confirmed",
              lead: `Your booking for ${input.resourceName} is confirmed.`,
              safeLead: `Your booking for <strong>${safeResource}</strong> is confirmed.`,
            };

  await sendMailWithRetry(transporter, {
    from,
    to: input.to,
    subject: copy.subject,
    text: [
      `Hello ${input.name},`,
      "",
      copy.lead,
      "",
      `Title: ${input.title}`,
      `When: ${input.whenLabel}`,
      `Where: ${input.location}`,
      "",
      `Check the web application to see this reservation: ${input.appUrl}`,
    ].join("\n"),
    html: `
      <p>Hello ${safeName},</p>
      <p>${copy.safeLead}</p>
      <p>
        <strong>Title:</strong> ${safeTitle}<br />
        <strong>When:</strong> ${safeWhen}<br />
        <strong>Where:</strong> ${safeLocation}
      </p>
      <p>Check the web application to see this reservation: <a href="${safeAppUrl}">${safeAppUrl}</a></p>
    `,
  });
}

export async function sendTemporaryPasswordEmail(
  input: TemporaryPasswordEmail
): Promise<void> {
  const { from, transporter } = await createTransporter();

  const safeName = escapeHtml(input.name);
  const safeEmail = escapeHtml(input.to);
  const safePassword = escapeHtml(input.temporaryPassword);
  const safeLoginUrl = escapeHtml(input.loginUrl);

  await sendMailWithRetry(transporter, {
    from,
    to: input.to,
    subject: "Your Ruhunu ResourceHub temporary password",
    text: [
      `Hello ${input.name},`,
      "",
      "An administrator created a Ruhunu ResourceHub account for you.",
      "",
      `Sign-in email: ${input.to}`,
      `Temporary password: ${input.temporaryPassword}`,
      "",
      `Sign in at ${input.loginUrl}`,
      "You will be asked to choose a new password after signing in.",
      "",
      "If you did not expect this email, contact your administrator.",
    ].join("\n"),
    html: `
      <p>Hello ${safeName},</p>
      <p>An administrator created a Ruhunu ResourceHub account for you.</p>
      <p>
        <strong>Sign-in email:</strong> ${safeEmail}<br />
        <strong>Temporary password:</strong> ${safePassword}
      </p>
      <p>
        <a href="${safeLoginUrl}">Sign in to Ruhunu ResourceHub</a>
        and choose a new password.
      </p>
      <p>If you did not expect this email, contact your administrator.</p>
    `,
  });
}
