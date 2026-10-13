import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth();

    if (!auth.ok) {
      return NextResponse.json(
        { message: auth.message },
        { status: auth.status }
      );
    }

    const { id } = await params;

    if (!id || id.length > 64) {
      return NextResponse.json(
        { message: "A valid reservation is required." },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("status" in body) ||
      body.status !== "CANCELLED"
    ) {
      return NextResponse.json(
        { message: "Only cancellation is supported." },
        { status: 400 }
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        endTime: true,
      },
    });

    if (!reservation || reservation.userId !== auth.user.id) {
      return NextResponse.json(
        { message: "Reservation not found." },
        { status: 404 }
      );
    }

    if (reservation.status === "CANCELLED") {
      return NextResponse.json(
        { message: "This reservation is already cancelled." },
        { status: 400 }
      );
    }

    if (reservation.endTime.getTime() <= Date.now()) {
      return NextResponse.json(
        { message: "Completed reservations cannot be cancelled." },
        { status: 400 }
      );
    }

    await prisma.reservation.update({
      where: { id: reservation.id },
      data: { status: "CANCELLED" },
    });

    return NextResponse.json({ message: "Reservation cancelled." });
  } catch (error) {
    console.error("Failed to cancel reservation:", error);

    return NextResponse.json(
      { message: "Failed to cancel the reservation." },
      { status: 500 }
    );
  }
}
