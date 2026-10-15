import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseResourceClassification } from "@/lib/resource-catalog";
import { isResourceLocation } from "@/lib/resource-locations";
import { parseResourceImages } from "@/lib/resource-images";
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
      !("category" in body) ||
      !("subcategory" in body) ||
      !("location" in body) ||
      !("status" in body) ||
      typeof body.name !== "string" ||
      typeof body.location !== "string" ||
      (body.status !== "ACTIVE" && body.status !== "INACTIVE")
    ) {
      return NextResponse.json(
        { message: "Name, category, subcategory, location, and status are required." },
        { status: 400 }
      );
    }

    const classification = parseResourceClassification(
      body.category,
      body.subcategory
    );

    if (!classification.ok) {
      return NextResponse.json(
        { message: classification.message },
        { status: 400 }
      );
    }

    const name = body.name.trim();
    const location = body.location.trim();
    const capacity = "capacity" in body ? body.capacity : 1;
    const description = "description" in body ? body.description : null;
    const facilities = "facilities" in body ? body.facilities : null;

    if (!name || name.length > 120) {
      return NextResponse.json(
        { message: "Resource name must be between 1 and 120 characters." },
        { status: 400 }
      );
    }

    if (!isResourceLocation(location)) {
      const existing = await prisma.resource.findUnique({
        where: { id },
        select: { location: true },
      });

      if (!existing || existing.location !== location) {
        return NextResponse.json(
          { message: "Choose a location from the list." },
          { status: 400 }
        );
      }
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

    if (
      facilities !== null &&
      (typeof facilities !== "string" || facilities.length > 500)
    ) {
      return NextResponse.json(
        { message: "Facilities must be 500 characters or fewer." },
        { status: 400 }
      );
    }

    const parsedImages =
      "images" in body ? parseResourceImages(body.images) : null;

    if (parsedImages && !parsedImages.ok) {
      return NextResponse.json(
        { message: parsedImages.message },
        { status: 400 }
      );
    }

    const resource = await prisma.resource.update({
      where: { id },
      data: {
        name,
        category: classification.category,
        subcategory: classification.subcategory,
        location,
        capacity,
        status: body.status,
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        facilities:
          typeof facilities === "string" && facilities.trim()
            ? facilities.trim()
            : null,
        ...(parsedImages?.ok ? { images: parsedImages.images } : {}),
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
      select: { id: true, name: true, status: true },
    });

    if (!resource) {
      return NextResponse.json(
        { message: "Resource not found." },
        { status: 404 }
      );
    }

    const openBookings = await prisma.reservation.count({
      where: {
        resourceId: resource.id,
        status: { in: ["CONFIRMED", "PENDING"] },
        endTime: { gt: new Date() },
      },
    });

    if (resource.status === "ACTIVE") {
      const updated = await prisma.resource.update({
        where: { id: resource.id },
        data: { status: "INACTIVE" },
        select: { id: true, name: true, status: true },
      });

      return NextResponse.json({
        message:
          openBookings > 0
            ? `${updated.name} is now unavailable. You can delete it after the upcoming reservations are finished.`
            : `${updated.name} is now unavailable. You can delete it now.`,
        resource: updated,
      });
    }

    if (openBookings > 0) {
      return NextResponse.json(
        {
          message: `${resource.name} still has upcoming reservations. You can delete it after they are finished.`,
        },
        { status: 400 }
      );
    }

    await prisma.$transaction([
      prisma.reservation.deleteMany({
        where: { resourceId: resource.id },
      }),
      prisma.resource.delete({
        where: { id: resource.id },
      }),
    ]);

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

    console.error("Failed to remove resource:", error);

    return NextResponse.json(
      { message: "Failed to remove the resource." },
      { status: 500 }
    );
  }
}
