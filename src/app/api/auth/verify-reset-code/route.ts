import { NextResponse } from "next/server";
import { confirmResetCode } from "@/lib/confirm-reset-code";
import { normalizeResetEmail } from "@/lib/password-reset";

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("email" in body) ||
      !("otp" in body) ||
      typeof body.email !== "string" ||
      typeof body.otp !== "string"
    ) {
      return NextResponse.json(
        { message: "Email and reset code are required." },
        { status: 400 }
      );
    }

    const email = normalizeResetEmail(body.email);

    if (!email) {
      return NextResponse.json(
        { message: "Enter the email and the 6-digit code from the email." },
        { status: 400 }
      );
    }

    const result = await confirmResetCode(email, body.otp);

    if (!result.ok) {
      return NextResponse.json(
        { message: result.message },
        { status: result.status }
      );
    }

    return NextResponse.json({
      message: "Code verified. Choose a new password.",
    });
  } catch (error) {
    console.error("Verify reset code error:", error);

    return NextResponse.json(
      { message: "Unable to verify the code. Please try again." },
      { status: 500 }
    );
  }
}
