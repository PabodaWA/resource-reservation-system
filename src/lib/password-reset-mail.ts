import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

type PasswordResetOtpEmail = {
  to: string;
  name: string;
  otp: string;
};

function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function createTransporter() {
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

  const nodemailer = require("nodemailer") as {
    createTransport: (options: {
      host: string;
      port: number;
      secure: boolean;
      auth: { user: string; pass: string };
    }) => {
      sendMail: (mail: {
        from: string;
        to: string;
        subject: string;
        text: string;
        html: string;
      }) => Promise<unknown>;
    };
  };

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

export async function sendPasswordResetOtpEmail(
  input: PasswordResetOtpEmail
): Promise<void> {
  const { from, transporter } = await createTransporter();
  const safeName = escapeHtml(input.name);
  const safeOtp = escapeHtml(input.otp);

  await transporter.sendMail({
    from,
    to: input.to,
    subject: "Your Ruhunu ResourceHub password reset code",
    text: [
      `Hello ${input.name},`,
      "",
      "Use this code to reset your Ruhunu ResourceHub password:",
      "",
      input.otp,
      "",
      "This code expires in 5 minutes. After that, request a new code from the sign-in page.",
      "",
      "If you did not ask to reset your password, you can ignore this email.",
    ].join("\n"),
    html: `
      <p>Hello ${safeName},</p>
      <p>Use this code to reset your Ruhunu ResourceHub password:</p>
      <p style="font-size:28px;font-weight:700;letter-spacing:0.3em;">${safeOtp}</p>
      <p>This code expires in 5 minutes. After that, request a new code from the sign-in page.</p>
      <p>If you did not ask to reset your password, you can ignore this email.</p>
    `,
  });
}
