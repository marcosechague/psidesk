-- CreateEnum
CREATE TYPE "ProcessStatus" AS ENUM ('ACTIVE', 'ENDED');

-- CreateTable
CREATE TABLE "Process" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "motivo" TEXT,
    "status" "ProcessStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Process_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Process_patientId_idx" ON "Process"("patientId");

-- AddForeignKey
ALTER TABLE "Process" ADD CONSTRAINT "Process_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable: processId en SessionParticipant y Assignment
ALTER TABLE "SessionParticipant" ADD COLUMN "processId" TEXT;
ALTER TABLE "Assignment" ADD COLUMN "processId" TEXT;
CREATE INDEX "SessionParticipant_processId_idx" ON "SessionParticipant"("processId");
CREATE INDEX "Assignment_processId_idx" ON "Assignment"("processId");
ALTER TABLE "SessionParticipant" ADD CONSTRAINT "SessionParticipant_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_processId_fkey" FOREIGN KEY ("processId") REFERENCES "Process"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- DataMigration: motivos previos (ConsultationReason) -> procesos
INSERT INTO "Process" ("id", "patientId", "motivo", "status", "startedAt", "endedAt", "createdAt")
SELECT gen_random_uuid()::text, "patientId", "text",
       CASE WHEN "status" = 'RESOLVED' THEN 'ENDED'::"ProcessStatus" ELSE 'ACTIVE'::"ProcessStatus" END,
       "startedAt", "resolvedAt", "createdAt"
FROM "ConsultationReason";

-- DataMigration: proceso por defecto para pacientes con sesiones/tests pero sin proceso
INSERT INTO "Process" ("id", "patientId", "motivo", "status", "startedAt", "createdAt")
SELECT gen_random_uuid()::text, p."id", NULL, 'ACTIVE'::"ProcessStatus", p."createdAt", p."createdAt"
FROM "Patient" p
WHERE NOT EXISTS (SELECT 1 FROM "Process" pr WHERE pr."patientId" = p."id")
  AND (
    EXISTS (SELECT 1 FROM "Assignment" a WHERE a."patientId" = p."id")
    OR EXISTS (SELECT 1 FROM "SessionParticipant" sp WHERE sp."patientId" = p."id")
  );

-- DataMigration: enganchar participaciones y tests al proceso preferido del paciente
-- (activo más reciente; si no hay activo, el más reciente)
UPDATE "SessionParticipant" sp SET "processId" = (
  SELECT pr."id" FROM "Process" pr
  WHERE pr."patientId" = sp."patientId"
  ORDER BY (pr."status" = 'ACTIVE') DESC, pr."startedAt" DESC
  LIMIT 1
);
UPDATE "Assignment" a SET "processId" = (
  SELECT pr."id" FROM "Process" pr
  WHERE pr."patientId" = a."patientId"
  ORDER BY (pr."status" = 'ACTIVE') DESC, pr."startedAt" DESC
  LIMIT 1
);

-- DropTable / DropEnum: ConsultationReason queda reemplazado por Process
DROP TABLE "ConsultationReason";
DROP TYPE "ReasonStatus";
