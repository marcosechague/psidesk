-- Modelo unificado de resultados de test: respuestas (paciente o profesional) y
-- resultado (sistema o profesional, editable). Aditivo: no rompe el flujo actual.

-- CreateEnum
CREATE TYPE "ResponseAuthor" AS ENUM ('PATIENT', 'PROFESSIONAL');
CREATE TYPE "ResultAuthor" AS ENUM ('SYSTEM', 'PROFESSIONAL');

-- AlterTable: Test puede ser externo (sin motor de corrección)
ALTER TABLE "Test" ADD COLUMN "scored" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: quién cargó las respuestas
ALTER TABLE "Response" ADD COLUMN "enteredBy" "ResponseAuthor" NOT NULL DEFAULT 'PATIENT';

-- AlterTable: resultado con origen, hallazgos libres, notas y edición manual
ALTER TABLE "Result" ALTER COLUMN "scoresJson" DROP NOT NULL;
ALTER TABLE "Result" ADD COLUMN "findingsJson" JSONB;
ALTER TABLE "Result" ADD COLUMN "notes" TEXT;
ALTER TABLE "Result" ADD COLUMN "source" "ResultAuthor" NOT NULL DEFAULT 'SYSTEM';
ALTER TABLE "Result" ADD COLUMN "editedAt" TIMESTAMP(3);
