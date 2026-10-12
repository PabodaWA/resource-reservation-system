
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

async function main() {
  const name = process.env.ADMIN_NAME?.trim();
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!name || !email || !password) {
    throw new Error(
      "Set ADMIN_NAME, ADMIN_EMAIL, and ADMIN_PASSWORD in your environment."
    );
  }

  if (password.length < 12 || password.length > 128) {
    throw new Error("Admin password must contain 12–128 characters.");
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is missing.");
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new Error(
        "This email already exists. No account was changed."
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role: "ADMIN",
        isActive: true,
        mustChangePassword: true,
      },
    });

    console.log("Initial Admin account created successfully.");
    console.log(`Admin email: ${email}`);
    console.log("The Admin must change the temporary password at first login.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error("Admin creation failed:", error);
  process.exitCode = 1;
});
