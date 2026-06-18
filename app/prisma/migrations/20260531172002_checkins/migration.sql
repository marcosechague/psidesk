-- CreateEnum
CREATE TYPE "CheckinQuestionType" AS ENUM ('SCALE_1_10', 'YES_NO', 'CHOICE');

-- CreateEnum
CREATE TYPE "CheckinFrequency" AS ENUM ('DAILY', 'EVERY_N_DAYS', 'WEEKDAYS');

-- CreateEnum
CREATE TYPE "CheckinPlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'ENDED');

-- CreateEnum
CREATE TYPE "CheckinEntryStatus" AS ENUM ('PENDING', 'SENT', 'RESPONDED', 'FAILED', 'SKIPPED');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN     "phone" TEXT,
ADD COLUMN     "whatsappOptIn" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "CheckinPlan" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "questionType" "CheckinQuestionType" NOT NULL,
    "optionsJson" JSONB,
    "frequency" "CheckinFrequency" NOT NULL,
    "everyNDays" INTEGER,
    "weekdaysJson" JSONB,
    "timeOfDay" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Argentina/Buenos_Aires',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CheckinPlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckinPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckinEntry" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" "CheckinEntryStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "providerMessageId" TEXT,
    "responseText" TEXT,
    "responseValue" INTEGER,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckinEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CheckinPlan_patientId_idx" ON "CheckinPlan"("patientId");

-- CreateIndex
CREATE INDEX "CheckinPlan_status_idx" ON "CheckinPlan"("status");

-- CreateIndex
CREATE INDEX "CheckinEntry_status_idx" ON "CheckinEntry"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CheckinEntry_planId_scheduledFor_key" ON "CheckinEntry"("planId", "scheduledFor");

-- AddForeignKey
ALTER TABLE "CheckinPlan" ADD CONSTRAINT "CheckinPlan_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckinEntry" ADD CONSTRAINT "CheckinEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "CheckinPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
