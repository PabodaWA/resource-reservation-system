import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/require-auth";

export async function PATCH(
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
        { message: "A valid resource is required." },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();

    if (
      typeof body !== "object" ||
      body === null ||
      !("name" in body) ||
      !("type" in body) ||
      !("location" in body) ||
      !("status" in body) ||
      typeof body.name !== "string" ||
      typeof body.type !== "string" ||
      typeof body.location !== "string" ||
      (body.status !== "ACTIVE" && body.status !== "INACTIVE")
    ) {
      return NextResponse.json(
        { message: "Name, type, location, and status are required." },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const type = body.type.trim();
    const location = body.location.trim();
    const capacity = "capacity" in body ? body.capacity : 1;
    const description = "description" in body ? body.description : null;

    if (!name || name.length > 120) {
      return NextResponse.json(
        { message: "Resource name must be between 1 and 120 characters." },
        { status: 400 }
      );
    }

    if (!type || type.length > 80) {
      return NextResponse.json(
        { message: "A valid resource type is required." },
        { status: 400 }
      );
    }

    if (!location || location.length > 160) {
      return NextResponse.json(
        { message: "Location must be between 1 and 160 characters." },
        { status: 400 }
      );
    }

    if (
      typeof capacity !== "number" ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 10000
    ) {
      return NextResponse.json(
        { message: "Capacity must be a whole number between 1 and 10000." },
        { status: 400 }
      );
    }

    if (
      description !== null &&
      (typeof description !== "string" || description.length > 1000)
    ) {
      return NextResponse.json(
        { message: "Description must be 1000 characters or fewer." },
        { status: 400 }
      );
    }

    const resource = await prisma.resource.update({
      where: { id },
      data: {
        name,
        type,
        location,
        capacity,
        status: body.status,
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return NextResponse.json({
      message: `${resource.name} was updated.`,
      resource,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Resource not found." },
        { status: 404 }
      );
    }

    console.error("Failed to update resource:", error);

    return NextResponse.json(
      { message: "Failed to update the resource." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
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
        { message: "A valid resource is required." },
        { status: 400 }
      );
    }

    const resource = await prisma.resource.findUnique({
      where: { id },
      select: { id: true, name: true },
    });

    if (!resource) {
      return NextResponse.json(
        { message: "Resource not found." },
        { status: 404 }
      );
    }

    const bookings = await prisma.reservation.count({
      where: { resourceId: resource.id },
    });

    if (bookings > 0) {
      return NextResponse.json(
        {
          message:
            "This resource has reservations, so it cannot be deleted. Mark it unavailable instead.",
        },
        { status: 400 }
      );
    }

    await prisma.resource.delete({ where: { id: resource.id } });

    return NextResponse.json({
      message: `${resource.name} was deleted.`,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return NextResponse.json(
        { message: "Resource not found." },
        { status: 404 }
      );
    }

    console.error("Failed to delete resource:", error);

    return NextResponse.json(
      { message: "Failed to delete the resource." },
      { status: 500 }
    );
  }
}
