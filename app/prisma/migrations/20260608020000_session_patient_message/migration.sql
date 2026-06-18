-- Mensaje opcional para el paciente al cerrar la sesión (separado de las notas
-- clínicas). Se envía por WhatsApp; null/"" = no se envía nada.
ALTER TABLE "Session" ADD COLUMN "patientMessage" TEXT;
