import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/require-auth";

const MIN_DURATION_MS = 15 * 60 * 1000;
const MAX_DURATION_MS = 12 * 60 * 60 * 1000;
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

    if (duration < MIN_DURATION_MS || duration > MAX_DURATION_MS) {
      return NextResponse.json(
        { message: "A booking must last between 15 minutes and 12 hours." },
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

    const reservation = await prisma.$transaction(
      async (tx) => {
        const resource = await tx.resource.findUnique({
          where: { id: resourceId },
          select: { id: true, status: true },
        });

        if (!resource || resource.status !== "ACTIVE") {
          throw new ReservationRequestError(
            "That resource is not available to book.",
            404
          );
        }

        const conflict = await tx.reservation.findFirst({
          where: {
            resourceId,
            status: "CONFIRMED",
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
            userId: auth.user.id,
            resourceId,
          },
          select: { id: true },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );

    return NextResponse.json(
      { id: reservation.id, message: "Reservation booked." },
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
