import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import {
  appUrlFrom,
  emailBooker,
  isMailConfigured,
  sendParticipantCancellation,
  sendParticipantNotice,
} from "@/lib/mail";
import {
  MIN_BOOKING_MS,
  VEHICLE_MAX_BOOKING_MS,
  bookingDurationMessage,
  bookingNeedsApproval,
  canBookMeetingRoom,
  isMeetingRoom,
  maxBookingDurationMs,
} from "@/lib/resource-catalog";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requireAuth } from "@/lib/require-auth";
import {
  ParticipantInputError,
  assertParticipantCapacity,
  formatBookingWindow,
  isValidTimeZone,
  parseParticipants,
} from "@/lib/reservation-participants";

const MAX_LEAD_MS = 90 * 24 * 60 * 60 * 1000;
const START_GRACE_MS = 60 * 1000;

class ReservationEditError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

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

    if (isPendingEdit(body)) {
      return updatePendingReservation(auth.user.id, id, body);
    }

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
        user: { select: { name: true, email: true } },
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

      if (
        reservation.status === "CONFIRMED" &&
        auth.user.role === "ADMIN" &&
        reservation.userId !== auth.user.id
      ) {
        return NextResponse.json(
          {
            message:
              "A confirmed booking made by a user cannot be cancelled.",
          },
          { status: 403 }
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

      let message = declinedByAdmin
        ? "The approval request was declined."
        : "Reservation cancelled.";
      const whenLabel = formatBookingWindow(
        reservation.startTime,
        reservation.endTime,
        "Asia/Colombo"
      );

      if (
        reservation.status === "CONFIRMED" &&
        reservation.participants.length > 0
      ) {
        message += await emailCancellation(
          reservation.participants,
          {
            bookerName: reservation.user.name,
            resourceName: reservation.resource.name,
            location: reservation.resource.location,
            title: reservation.title,
            whenLabel,
            appUrl: appUrlFrom(request),
          }
        );
      }

      message += await emailBooker(request, {
        to: reservation.user.email,
        name: reservation.user.name,
        resourceName: reservation.resource.name,
        location: reservation.resource.location,
        title: reservation.title,
        whenLabel,
        outcome: declinedByAdmin ? "declined" : "cancelled",
        sentToActor: reservation.user.email === auth.user.email,
      });

      return NextResponse.json({ message });
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
            appUrl: appUrlFrom(request),
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

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin();

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

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        title: true,
        status: true,
        startTime: true,
        endTime: true,
        user: { select: { name: true, email: true } },
        resource: { select: { name: true, location: true } },
        participants: { select: { name: true, email: true } },
      },
    });

    if (!reservation) {
      return NextResponse.json(
        { message: "Reservation not found." },
        { status: 404 }
      );
    }

    if (reservation.status === "CONFIRMED" && reservation.userId !== auth.user.id) {
      return NextResponse.json(
        {
          message: "A confirmed booking made by a user cannot be deleted.",
        },
        { status: 403 }
      );
    }

    await prisma.reservation.delete({ where: { id: reservation.id } });

    const stillActive =
      reservation.status !== "CANCELLED" &&
      reservation.endTime.getTime() > Date.now();
    let message = "Reservation deleted.";

    if (stillActive) {
      const whenLabel = formatBookingWindow(
        reservation.startTime,
        reservation.endTime,
        "Asia/Colombo"
      );
      const booking = {
        bookerName: reservation.user.name,
        resourceName: reservation.resource.name,
        location: reservation.resource.location,
        title: reservation.title,
        whenLabel,
        appUrl: appUrlFrom(request),
      };

      if (
        reservation.status === "CONFIRMED" &&
        reservation.participants.length > 0
      ) {
        message += await emailCancellation(reservation.participants, booking);
      }

      message += await emailBooker(request, {
        to: reservation.user.email,
        name: reservation.user.name,
        resourceName: reservation.resource.name,
        location: reservation.resource.location,
        title: reservation.title,
        whenLabel,
        outcome: reservation.status === "PENDING" ? "declined" : "cancelled",
        sentToActor: reservation.user.email === auth.user.email,
      });
    }

    return NextResponse.json({ message });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Reservation not found." },
        { status: 404 }
      );
    }

    console.error("Failed to delete reservation:", error);

    return NextResponse.json(
      { message: "Failed to delete the reservation." },
      { status: 500 }
    );
  }
}

type PendingEditBody = {
  title: string;
  startTime: string;
  endTime: string;
  purpose?: unknown;
  participants?: unknown;
  notifyParticipants?: unknown;
  timeZone?: unknown;
};

async function emailCancellation(
  participants: { name: string; email: string }[],
  booking: {
    bookerName: string;
    resourceName: string;
    location: string;
    title: string;
    whenLabel: string;
    appUrl: string;
  }
) {
  if (!isMailConfigured()) {
    return participants.length === 1
      ? " The cancellation email could not be sent."
      : " The cancellation emails could not be sent.";
  }

  const results = await Promise.allSettled(
    participants.map((person) =>
      sendParticipantCancellation({
        to: person.email,
        name: person.name,
        ...booking,
      })
    )
  );
  const notified = results.filter((result) => result.status === "fulfilled").length;

  for (const result of results) {
    if (result.status === "rejected") {
      console.error("Failed to send cancellation email:", result.reason);
    }
  }

  if (notified === participants.length) {
    return " They were emailed that this booking was cancelled.";
  }

  if (notified > 0) {
    return " Some cancellation emails could not be sent.";
  }

  return participants.length === 1
    ? " The cancellation email could not be sent."
    : " The cancellation emails could not be sent.";
}

function isPendingEdit(body: unknown): body is PendingEditBody {
  return (
    typeof body === "object" &&
    body !== null &&
    !("status" in body) &&
    "title" in body &&
    "startTime" in body &&
    "endTime" in body &&
    typeof body.title === "string" &&
    typeof body.startTime === "string" &&
    typeof body.endTime === "string"
  );
}

async function updatePendingReservation(
  userId: string,
  id: string,
  body: PendingEditBody
) {
  const title = body.title.trim();

  if (!title || title.length > 120) {
    return NextResponse.json(
      { message: "Title must be between 1 and 120 characters." },
      { status: 400 }
    );
  }

  const purpose = typeof body.purpose === "string" ? body.purpose.trim() : "";

  if (!purpose) {
    return NextResponse.json(
      { message: "Enter a purpose for this booking." },
      { status: 400 }
    );
  }

  if (purpose.length > 500) {
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

  const notifyParticipants = body.notifyParticipants === true;
  const requestedTimeZone =
    typeof body.timeZone === "string" ? body.timeZone.trim() : "";
  const timeZone = isValidTimeZone(requestedTimeZone)
    ? requestedTimeZone
    : "UTC";
  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        const current = await tx.reservation.findUnique({
          where: { id },
          select: {
            id: true,
            userId: true,
            status: true,
            endTime: true,
            resourceId: true,
            user: { select: { email: true } },
            resource: {
              select: {
                category: true,
                capacity: true,
                status: true,
              },
            },
          },
        });

        if (!current || current.userId !== userId) {
          throw new ReservationEditError("Reservation not found.", 404);
        }

        if (current.status !== "PENDING") {
          throw new ReservationEditError(
            "Only a request that is waiting for approval can be edited.",
            400
          );
        }

        if (current.endTime.getTime() <= Date.now()) {
          throw new ReservationEditError(
            "Completed reservations cannot be changed.",
            400
          );
        }

        if (!current.resource || current.resource.status !== "ACTIVE") {
          throw new ReservationEditError(
            "That resource is not available to book.",
            404
          );
        }

        if (duration > maxBookingDurationMs(current.resource.category)) {
          throw new ReservationEditError(
            bookingDurationMessage(current.resource.category),
            400
          );
        }

        const editor = await tx.user.findUnique({
          where: { id: userId },
          select: { role: true, jobPosition: true },
        });

        if (
          isMeetingRoom(current.resource.category) &&
          (!editor || !canBookMeetingRoom(editor.role, editor.jobPosition))
        ) {
          throw new ReservationEditError(
            "Only a manager, team leader, or scrum master can book a meeting room.",
            403
          );
        }

        try {
          assertParticipantCapacity(
            current.resource.capacity,
            participants,
            current.user.email
          );
        } catch (error) {
          if (error instanceof ParticipantInputError) {
            throw new ReservationEditError(error.message, 400);
          }

          throw error;
        }

        const conflict = await tx.reservation.findFirst({
          where: {
            id: { not: current.id },
            resourceId: current.resourceId,
            status: { in: ["CONFIRMED", "PENDING"] },
            startTime: { lt: end },
            endTime: { gt: start },
          },
          select: { id: true },
        });

        if (conflict) {
          throw new ReservationEditError(
            "That resource is already booked for the selected time.",
            409
          );
        }

        return tx.reservation.update({
          where: { id: current.id },
          data: {
            title,
            purpose,
            startTime: start,
            endTime: end,
            status: bookingNeedsApproval(
              current.resource.category,
              start,
              end,
              timeZone
            )
              ? "PENDING"
              : "CONFIRMED",
            participants: {
              deleteMany: {},
              ...(participants.length > 0 ? { create: participants } : {}),
            },
          },
          select: {
            title: true,
            status: true,
            startTime: true,
            endTime: true,
            user: { select: { name: true } },
            resource: { select: { name: true, location: true } },
            participants: { select: { name: true, email: true } },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    const confirmed = reservation.status === "CONFIRMED";
    let notified = 0;
    let notifyFailed = false;

    if (confirmed && notifyParticipants && reservation.participants.length > 0) {
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
              appUrl: appUrlFrom(request),
            })
          )
        );

        notified = results.filter((result) => result.status === "fulfilled").length;
        notifyFailed = notified !== reservation.participants.length;
      }
    }

    const others = reservation.participants.length;
    let message = confirmed
      ? "Your request was updated and is now confirmed."
      : "Your request was updated. It is still waiting for an administrator to approve it.";

    if (confirmed && others > 0 && notifyParticipants) {
      if (notified === others) {
        message += " They were emailed about this time.";
      } else if (notified > 0 || notifyFailed) {
        message += " Some participant emails could not be sent.";
      }
    }

    return NextResponse.json({ message });
  } catch (error) {
    if (error instanceof ReservationEditError) {
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

    throw error;
  }
}
