-- AlterTable: ficha clínica estructurada (anamnesis) en JSON
ALTER TABLE "Patient" ADD COLUMN "clinicalRecordJson" JSONB;
