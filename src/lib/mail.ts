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

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

  // Loaded here so this file stays a synchronous module. A top-level
  // nodemailer import makes Turbopack evaluate it asynchronously and the
  // participant notice export is then missing at call time.
  const { default: nodemailer } = await import("nodemailer");

  return {
    from,
    transporter: nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
    }),
  };
}

type ParticipantNoticeEmail = {
  to: string;
  name: string;
  bookerName: string;
  resourceName: string;
  location: string;
  title: string;
  whenLabel: string;
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

  await transporter.sendMail({
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
      "You do not need to sign in or reply. This note is only to tell you the resource is reserved for that time.",
    ].join("\n"),
    html: `
      <p>Hello ${safeName},</p>
      <p>${safeBooker} booked <strong>${safeResource}</strong> and included you.</p>
      <p>
        <strong>Title:</strong> ${safeTitle}<br />
        <strong>When:</strong> ${safeWhen}<br />
        <strong>Where:</strong> ${safeLocation}
      </p>
      <p>You do not need to sign in or reply. This note is only to tell you the resource is reserved for that time.</p>
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

  await transporter.sendMail({
    from,
    to: input.to,
    subject: "Your ReserveFlow temporary password",
    text: [
      `Hello ${input.name},`,
      "",
      "An administrator created a ReserveFlow account for you.",
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
      <p>An administrator created a ReserveFlow account for you.</p>
      <p>
        <strong>Sign-in email:</strong> ${safeEmail}<br />
        <strong>Temporary password:</strong> ${safePassword}
      </p>
      <p>
        <a href="${safeLoginUrl}">Sign in to ReserveFlow</a>
        and choose a new password.
      </p>
      <p>If you did not expect this email, contact your administrator.</p>
    `,
  });
}
