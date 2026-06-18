/*
  Warnings:

  - You are about to drop the `Appointment` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `SessionNote` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELED', 'NO_SHOW');

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_patientId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT "Appointment_userId_fkey";

-- DropForeignKey
ALTER TABLE "SessionNote" DROP CONSTRAINT "SessionNote_patientId_fkey";

-- DropTable
DROP TABLE "Appointment";

-- DropTable
DROP TABLE "SessionNote";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT,
    "title" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMin" INTEGER NOT NULL DEFAULT 50,
    "status" "SessionStatus" NOT NULL DEFAULT 'SCHEDULED',
    "topic" TEXT,
    "topicOther" TEXT,
    "observations" TEXT,
    "goals" TEXT,
    "nextSteps" TEXT,
    "reminderOffsetMin" INTEGER,
    "reminderSentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Session_userId_startsAt_idx" ON "Session"("userId", "startsAt");

-- CreateIndex
CREATE INDEX "Session_patientId_idx" ON "Session"("patientId");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
