-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'IN_PROGRESS';

-- CreateTable
CREATE TABLE "SessionParticipant" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "individualNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionParticipant_sessionId_patientId_key" ON "SessionParticipant"("sessionId", "patientId");

-- CreateIndex
CREATE INDEX "SessionParticipant_patientId_idx" ON "SessionParticipant"("patientId");

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "Session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DataMigration: cada Session.patientId existente se convierte en un SessionParticipant
INSERT INTO "SessionParticipant" ("id", "sessionId", "patientId", "createdAt")
SELECT gen_random_uuid()::text, "id", "patientId", "createdAt"
FROM "Session"
WHERE "patientId" IS NOT NULL;

-- AlterTable: campos del cronómetro
ALTER TABLE "Session" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Session" ADD COLUMN "endedAt" TIMESTAMP(3);

-- DropForeignKey + DropIndex + DropColumn: patientId migra a SessionParticipant
ALTER TABLE "Session" DROP CONSTRAINT "Session_patientId_fkey";
DROP INDEX "Session_patientId_idx";
ALTER TABLE "Session" DROP COLUMN "patientId";
