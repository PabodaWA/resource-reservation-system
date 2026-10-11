
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
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
      !body.location.trim()
    ) {
      return NextResponse.json(
        { message: "Name, type, and location are required." },
        { status: 400 }
      );
    }

    const capacity =
      "capacity" in body ? body.capacity : 1;

    if (
      typeof capacity !== "number" ||
      !Number.isInteger(capacity) ||
      capacity < 1
    ) {
      return NextResponse.json(
        { message: "Capacity must be a positive integer." },
        { status: 400 }
      );
    }

    const description =
      "description" in body ? body.description : undefined;

    if (
      description !== undefined &&
      description !== null &&
      typeof description !== "string"
    ) {
      return NextResponse.json(
        { message: "Description must be a string." },
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
