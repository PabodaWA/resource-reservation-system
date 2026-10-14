import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { isMailConfigured, sendParticipantNotice } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";
import { formatBookingWindow } from "@/lib/reservation-participants";

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
    const nextStatus =
      typeof body === "object" &&
      body !== null &&
      "status" in body &&
      (body.status === "CANCELLED" || body.status === "CONFIRMED")
        ? body.status
        : null;

    if (!nextStatus) {
      return NextResponse.json(
        { message: "Choose whether to approve or cancel this reservation." },
        { status: 400 }
      );
    }

    if (nextStatus === "CONFIRMED" && auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { message: "Only an administrator can approve a booking." },
        { status: 403 }
      );
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        title: true,
        userId: true,
        resourceId: true,
        status: true,
        startTime: true,
        endTime: true,
        user: { select: { name: true } },
        resource: { select: { name: true, location: true } },
        participants: { select: { name: true, email: true } },
      },
    });

    if (
      !reservation ||
      (reservation.userId !== auth.user.id && auth.user.role !== "ADMIN")
    ) {
      return NextResponse.json(
        { message: "Reservation not found." },
        { status: 404 }
      );
    }

    if (reservation.endTime.getTime() <= Date.now()) {
      return NextResponse.json(
        { message: "Completed reservations cannot be changed." },
        { status: 400 }
      );
    }

    if (nextStatus === "CANCELLED") {
      if (reservation.status === "CANCELLED") {
        return NextResponse.json(
          { message: "This reservation is already cancelled." },
          { status: 400 }
        );
      }

      await prisma.reservation.update({
        where: { id: reservation.id },
        data: { status: "CANCELLED" },
      });

      const declinedByAdmin =
        reservation.status === "PENDING" &&
        auth.user.role === "ADMIN" &&
        reservation.userId !== auth.user.id;

      return NextResponse.json({
        message: declinedByAdmin
          ? "The approval request was declined."
          : "Reservation cancelled.",
      });
    }

    if (reservation.status !== "PENDING") {
      return NextResponse.json(
        { message: "Only a booking that is waiting for approval can be confirmed." },
        { status: 400 }
      );
    }

    const approved = await prisma.$transaction(
      async (tx) => {
        const conflict = await tx.reservation.findFirst({
          where: {
            id: { not: reservation.id },
            resourceId: reservation.resourceId,
            status: { in: ["CONFIRMED", "PENDING"] },
            startTime: { lt: reservation.endTime },
            endTime: { gt: reservation.startTime },
          },
          select: { id: true },
        });

        if (conflict) {
          return null;
        }

        return tx.reservation.update({
          where: { id: reservation.id },
          data: { status: "CONFIRMED" },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    if (!approved) {
      return NextResponse.json(
        { message: "That time is no longer free, so this request cannot be approved." },
        { status: 409 }
      );
    }

    let message = "Booking approved. It is now confirmed.";

    if (reservation.participants.length > 0 && isMailConfigured()) {
      const whenLabel = formatBookingWindow(
        reservation.startTime,
        reservation.endTime,
        "Asia/Colombo"
      );
      const results = await Promise.allSettled(
        reservation.participants.map((person) =>
          sendParticipantNotice({
            to: person.email,
            name: person.name,
            bookerName: reservation.user.name,
            resourceName: reservation.resource.name,
            location: reservation.resource.location,
            title: reservation.title,
            whenLabel,
          })
        )
      );
      const notified = results.filter((result) => result.status === "fulfilled").length;

      if (notified !== reservation.participants.length) {
        message += " Some participant emails could not be sent.";
      }
    }

    return NextResponse.json({ message });
  } catch (error) {
    console.error("Failed to update reservation:", error);

    return NextResponse.json(
      { message: "Failed to update the reservation." },
      { status: 500 }
    );
  }
}
