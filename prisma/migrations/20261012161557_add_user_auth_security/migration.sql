-- AlterTable
ALTER TABLE "User" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "lockedUntil" TIMESTAMP(3),
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordResetOtpExpiry" TIMESTAMP(3),
ADD COLUMN     "passwordResetOtpHash" TEXT;
