-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('SUPER_ADMIN', 'PSYCHOLOGIST');

-- CreateEnum
CREATE TYPE "BillingStatus" AS ENUM ('BETA', 'TRIAL', 'ACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "WhatsAppMessageType" AS ENUM ('CHECKIN', 'APPOINTMENT_REMINDER', 'APPOINTMENT_NOTICE', 'TEST_ASSIGNED', 'TEST_REMINDER', 'SESSION_TASK');

-- AlterTable
ALTER TABLE "Assignment" DROP COLUMN "reminderDaysBefore",
DROP COLUMN "reminderSentAt",
ADD COLUMN     "notifyOnAssign" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderOffsetsDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "remindersSentDays" INTEGER[] DEFAULT ARRAY[]::INTEGER[];

-- AlterTable
ALTER TABLE "CheckinPlan" ADD COLUMN     "processId" TEXT;

-- AlterTable
ALTER TABLE "Patient" DROP COLUMN "age",
ADD COLUMN     "birthDate" TIMESTAMP(3),
ADD COLUMN     "firstName" TEXT NOT NULL,
ADD COLUMN     "lastName" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "Process" ADD COLUMN     "motivoCategory" TEXT;

-- AlterTable
ALTER TABLE "Session" ADD COLUMN     "groupId" TEXT,
ADD COLUMN     "notifyPatient" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "summary" TEXT,
ADD COLUMN     "summaryAt" TIMESTAMP(3),
ADD COLUMN     "summaryFormat" TEXT,
ADD COLUMN     "summaryModel" TEXT,
ADD COLUMN     "taskSentAt" TIMESTAMP(3),
ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "voiceId" TEXT;

-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "categories" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "active" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "availability" JSONB,
ADD COLUMN     "billingStatus" "BillingStatus" NOT NULL DEFAULT 'BETA',
ADD COLUMN     "billingUntil" TIMESTAMP(3),
ADD COLUMN     "featureEntitlements" JSONB,
ADD COLUMN     "featurePreferences" JSONB,
ADD COLUMN     "firstName" TEXT,
ADD COLUMN     "lastName" TEXT,
ADD COLUMN     "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "patientMessageEmojis" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "prefix" TEXT,
ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'PSYCHOLOGIST',
ADD COLUMN     "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'platform',
    "featureFlags" JSONB,
    "aiProvider" TEXT,
    "aiModel" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ManualResult" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "testName" TEXT NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL,
    "findingsJson" JSONB NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Diagnosis" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Diagnosis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientGroup" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PatientGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PatientGroupMember" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,

    CONSTRAINT "PatientGroupMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NoteTemplate" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "structure" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NoteTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WritingVoice" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rulesJson" JSONB NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WritingVoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WhatsAppMessage" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "patientId" TEXT,
    "type" "WhatsAppMessageType" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "providerMessageId" TEXT,
    "sessionId" TEXT,
    "checkinEntryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WhatsAppMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualResult_patientId_idx" ON "ManualResult"("patientId");

-- CreateIndex
CREATE INDEX "Diagnosis_patientId_idx" ON "Diagnosis"("patientId");

-- CreateIndex
CREATE INDEX "PatientGroup_userId_idx" ON "PatientGroup"("userId");

-- CreateIndex
CREATE INDEX "PatientGroupMember_patientId_idx" ON "PatientGroupMember"("patientId");

-- CreateIndex
CREATE UNIQUE INDEX "PatientGroupMember_groupId_patientId_key" ON "PatientGroupMember"("groupId", "patientId");

-- CreateIndex
CREATE UNIQUE INDEX "NoteTemplate_code_key" ON "NoteTemplate"("code");

-- CreateIndex
CREATE INDEX "NoteTemplate_userId_idx" ON "NoteTemplate"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "WritingVoice_code_key" ON "WritingVoice"("code");

-- CreateIndex
CREATE INDEX "WritingVoice_userId_idx" ON "WritingVoice"("userId");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_userId_sentAt_idx" ON "WhatsAppMessage"("userId", "sentAt");

-- CreateIndex
CREATE INDEX "WhatsAppMessage_type_idx" ON "WhatsAppMessage"("type");

-- CreateIndex
CREATE INDEX "CheckinPlan_processId_idx" ON "CheckinPlan"("processId");

-- CreateIndex
CREATE INDEX "Session_groupId_idx" ON "Session"("groupId");

-- AddForeignKey
ALTER TABLE "ManualResult" ADD CONSTRAINT "ManualResult_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Diagnosis" ADD CONSTRAINT "Diagnosis_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientGroup" ADD CONSTRAINT "PatientGroup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientGroupMember" ADD CONSTRAINT "PatientGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PatientGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PatientGroupMember" ADD CONSTRAINT "PatientGroupMember_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "PatientGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NoteTemplate" ADD CONSTRAINT "NoteTemplate_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WritingVoice" ADD CONSTRAINT "WritingVoice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckinPlan" ADD CONSTRAINT "CheckinPlan_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WhatsAppMessage" ADD CONSTRAINT "WhatsAppMessage_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

