-- CreateEnum
CREATE TYPE "JobPosition" AS ENUM ('MANAGER', 'TEAM_LEADER', 'SCRUM_MASTER', 'EMPLOYEE');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "jobPosition" "JobPosition" NOT NULL DEFAULT 'EMPLOYEE';
