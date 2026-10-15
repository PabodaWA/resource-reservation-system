
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { isResourceLocation } from "@/lib/resource-locations";
import { parseResourceImages } from "@/lib/resource-images";
import { requireAdmin, requireAuth } from "@/lib/require-auth";

export async function GET() {
  try {
    const auth = await requireAuth();

    if (!auth.ok) {
      return NextResponse.json(
        { message: auth.message },
        { status: auth.status }
      );
    }

    const resources = await prisma.resource.findMany({
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json(resources);
  } catch (error) {
    console.error("Failed to fetch resources:", error);

    return NextResponse.json(
      { message: "Failed to fetch resources." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();

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
      !("name" in body) ||
      !("type" in body) ||
      !("location" in body) ||
      typeof body.name !== "string" ||
      typeof body.type !== "string" ||
      typeof body.location !== "string" ||
      !body.name.trim() ||
      !body.type.trim() ||
      !body.location.trim() ||
      body.name.trim().length > 120 ||
      body.type.trim().length > 80 ||
      !isResourceLocation(body.location.trim())
    ) {
      return NextResponse.json(
        { message: "Valid name, type, and location are required." },
        { status: 400 }
      );
    }

    const capacity = "capacity" in body ? body.capacity : 1;

    if (
      typeof capacity !== "number" ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 10000
    ) {
      return NextResponse.json(
        { message: "Capacity must be an integer between 1 and 10000." },
        { status: 400 }
      );
    }

    const description = "description" in body ? body.description : undefined;

    if (
      description !== undefined &&
      description !== null &&
      (typeof description !== "string" || description.length > 1000)
    ) {
      return NextResponse.json(
        { message: "Description must be a string of at most 1000 characters." },
        { status: 400 }
      );
    }

    const images = "images" in body ? body.images : [];
    const parsedImages = parseResourceImages(images);

    if (!parsedImages.ok) {
      return NextResponse.json(
        { message: parsedImages.message },
        { status: 400 }
      );
    }

    const resource = await prisma.resource.create({
      data: {
        name: body.name.trim(),
        type: body.type.trim(),
        location: body.location.trim(),
        capacity,
        description:
          typeof description === "string" && description.trim()
            ? description.trim()
            : null,
        images: parsedImages.images,
      },
    });

    return NextResponse.json(resource, { status: 201 });
  } catch (error) {
    console.error("Failed to create resource:", error);

    return NextResponse.json(
      { message: "Failed to create resource." },
      { status: 500 }
    );
  }
}
