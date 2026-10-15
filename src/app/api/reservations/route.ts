import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { isMailConfigured, sendParticipantNotice } from "@/lib/mail";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";
import {
  MIN_BOOKING_MS,
  VEHICLE_MAX_BOOKING_MS,
  bookingDurationMessage,
  bookingNeedsApproval,
  canBookMeetingRoom,
  isCompanyVehicle,
  isMeetingRoom,
  maxBookingDurationMs,
} from "@/lib/resource-catalog";
import {
  ParticipantInputError,
  assertParticipantCapacity,
  formatBookingWindow,
  isValidTimeZone,
  parseParticipants,
} from "@/lib/reservation-participants";

const MAX_LEAD_MS = 90 * 24 * 60 * 60 * 1000;
const START_GRACE_MS = 60 * 1000;

class ReservationRequestError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();

    if (!auth.ok) {
      return NextResponse.json(
        { message: auth.message },
        { status: auth.status }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("resourceId" in body) ||
      !("title" in body) ||
      !("startTime" in body) ||
      !("endTime" in body) ||
      typeof body.resourceId !== "string" ||
      typeof body.title !== "string" ||
      typeof body.startTime !== "string" ||
      typeof body.endTime !== "string"
    ) {
      return NextResponse.json(
        { message: "Resource, title, start time, and end time are required." },
        { status: 400 }
      );
    }

    const resourceId = body.resourceId.trim();
    const title = body.title.trim();
    const purpose = "purpose" in body ? body.purpose : undefined;
    const requestedUserId = "userId" in body ? body.userId : undefined;

    if (
      requestedUserId !== undefined &&
      (typeof requestedUserId !== "string" ||
        !requestedUserId.trim() ||
        requestedUserId.trim().length > 64)
    ) {
      return NextResponse.json(
        { message: "Choose a valid person for this reservation." },
        { status: 400 }
      );
    }

    const bookForUserId = requestedUserId?.trim() || auth.user.id;

    if (bookForUserId !== auth.user.id && auth.user.role !== "ADMIN") {
      return NextResponse.json(
        { message: "You can only book a reservation for yourself." },
        { status: 403 }
      );
    }

    if (!resourceId || resourceId.length > 64) {
      return NextResponse.json(
        { message: "Choose a valid resource." },
        { status: 400 }
      );
    }

    if (!title || title.length > 120) {
      return NextResponse.json(
        { message: "Title must be between 1 and 120 characters." },
        { status: 400 }
      );
    }

    if (
      purpose !== undefined &&
      purpose !== null &&
      (typeof purpose !== "string" || purpose.length > 500)
    ) {
      return NextResponse.json(
        { message: "Purpose must be 500 characters or fewer." },
        { status: 400 }
      );
    }

    const start = new Date(body.startTime);
    const end = new Date(body.endTime);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return NextResponse.json(
        { message: "Start and end must be valid dates." },
        { status: 400 }
      );
    }

    if (end.getTime() <= start.getTime()) {
      return NextResponse.json(
        { message: "End time must be after the start time." },
        { status: 400 }
      );
    }

    const duration = end.getTime() - start.getTime();

    if (duration < MIN_BOOKING_MS) {
      return NextResponse.json(
        { message: "A booking must last at least 15 minutes." },
        { status: 400 }
      );
    }

    if (duration > VEHICLE_MAX_BOOKING_MS) {
      return NextResponse.json(
        { message: "A booking cannot be longer than 36 hours." },
        { status: 400 }
      );
    }

    const now = Date.now();

    if (start.getTime() < now - START_GRACE_MS) {
      return NextResponse.json(
        { message: "Start time cannot be in the past." },
        { status: 400 }
      );
    }

    if (start.getTime() > now + MAX_LEAD_MS) {
      return NextResponse.json(
        { message: "Bookings can be made up to 90 days ahead." },
        { status: 400 }
      );
    }

    let participants;

    try {
      participants = parseParticipants(
        "participants" in body ? body.participants : undefined
      );
    } catch (error) {
      if (error instanceof ParticipantInputError) {
        return NextResponse.json({ message: error.message }, { status: 400 });
      }

      throw error;
    }

    const notifyParticipants =
      "notifyParticipants" in body && body.notifyParticipants === true;
    const requestedTimeZone =
      "timeZone" in body && typeof body.timeZone === "string"
        ? body.timeZone.trim()
        : "";
    const timeZone = isValidTimeZone(requestedTimeZone)
      ? requestedTimeZone
      : "UTC";

    const reservation = await prisma.$transaction(
      async (tx) => {
        const resource = await tx.resource.findUnique({
          where: { id: resourceId },
          select: {
            id: true,
            category: true,
            capacity: true,
            status: true,
          },
        });

        if (!resource || resource.status !== "ACTIVE") {
          throw new ReservationRequestError(
            "That resource is not available to book.",
            404
          );
        }

        if (duration > maxBookingDurationMs(resource.category)) {
          throw new ReservationRequestError(
            bookingDurationMessage(resource.category),
            400
          );
        }

        const bookedUser = await tx.user.findUnique({
          where: { id: bookForUserId },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
            jobPosition: true,
            isActive: true,
          },
        });

        if (!bookedUser || !bookedUser.isActive) {
          throw new ReservationRequestError(
            "That person cannot receive a booking.",
            404
          );
        }

        if (
          isMeetingRoom(resource.category) &&
          !canBookMeetingRoom(bookedUser.role, bookedUser.jobPosition)
        ) {
          throw new ReservationRequestError(
            "Only a manager, team leader, or scrum master can book a meeting room.",
            403
          );
        }

        try {
          assertParticipantCapacity(
            resource.capacity,
            participants,
            bookedUser.email
          );
        } catch (error) {
          if (error instanceof ParticipantInputError) {
            throw new ReservationRequestError(error.message, 400);
          }

          throw error;
        }

        const conflict = await tx.reservation.findFirst({
          where: {
            resourceId,
            status: { in: ["CONFIRMED", "PENDING"] },
            startTime: { lt: end },
            endTime: { gt: start },
          },
          select: { id: true },
        });

        if (conflict) {
          throw new ReservationRequestError(
            "That resource is already booked for the selected time.",
            409
          );
        }

        return tx.reservation.create({
          data: {
            title,
            purpose:
              typeof purpose === "string" && purpose.trim()
                ? purpose.trim()
                : null,
            startTime: start,
            endTime: end,
            status: bookingNeedsApproval(
              resource.category,
              start,
              end,
              timeZone
            )
              ? "PENDING"
              : "CONFIRMED",
            userId: bookedUser.id,
            resourceId,
            participants: {
              create: participants,
            },
          },
          select: {
            id: true,
            title: true,
            status: true,
            startTime: true,
            endTime: true,
            user: { select: { name: true } },
            resource: { select: { name: true, location: true, category: true } },
            participants: { select: { name: true, email: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const awaitingApproval = reservation.status === "PENDING";
    const vehicleRequest = isCompanyVehicle(reservation.resource.category);
    let notified = 0;
    let notifyFailed = false;

    if (
      !awaitingApproval &&
      notifyParticipants &&
      reservation.participants.length > 0
    ) {
      if (!isMailConfigured()) {
        notifyFailed = true;
      } else {
        const whenLabel = formatBookingWindow(
          reservation.startTime,
          reservation.endTime,
          timeZone
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

        notified = results.filter((result) => result.status === "fulfilled").length;
        notifyFailed = notified !== reservation.participants.length;
      }
    }

    const others = reservation.participants.length;
    let message = vehicleRequest
      ? "This vehicle booking is waiting for an administrator to approve it."
      : awaitingApproval
        ? "This time is outside office hours (8:00 AM–8:00 PM), so the booking is waiting for an administrator to approve it."
        : "Reservation booked.";

    if (!awaitingApproval && others > 0) {
      message =
        others === 1
          ? "Reservation booked with 1 other person."
          : `Reservation booked with ${others} other people.`;

      if (notifyParticipants && notified === others) {
        message += " They were emailed about this time.";
      } else if (notifyParticipants && notified > 0) {
        message +=
          " The booking is saved, but some email notices could not be sent.";
      } else if (notifyParticipants && notifyFailed) {
        message +=
          " The booking is saved, but the email notice could not be sent.";
      }
    }

    return NextResponse.json(
      { id: reservation.id, message },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof ReservationRequestError) {
      return NextResponse.json(
        { message: error.message },
        { status: error.status }
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034"
    ) {
      return NextResponse.json(
        { message: "That time was just booked. Choose another slot." },
        { status: 409 }
      );
    }

    console.error("Failed to create reservation:", error);

    return NextResponse.json(
      { message: "Failed to book the reservation." },
      { status: 500 }
    );
  }
}
