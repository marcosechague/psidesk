-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "reminderOffsetMin" INTEGER,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Assignment" ADD COLUMN     "dueDate" TIMESTAMP(3),
ADD COLUMN     "reminderDaysBefore" INTEGER,
ADD COLUMN     "reminderSentAt" TIMESTAMP(3);
