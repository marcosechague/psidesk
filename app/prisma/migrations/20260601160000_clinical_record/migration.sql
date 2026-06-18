-- CreateEnum
CREATE TYPE "ReasonStatus" AS ENUM ('ACTIVE', 'RESOLVED');

-- AlterTable
ALTER TABLE "Patient" ADD COLUMN "clinicalNotes" TEXT;

-- CreateTable
CREATE TABLE "ConsultationReason" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "status" "ReasonStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ConsultationReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ConsultationReason_patientId_idx" ON "ConsultationReason"("patientId");

-- AddForeignKey
ALTER TABLE "ConsultationReason" ADD CONSTRAINT "ConsultationReason_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
