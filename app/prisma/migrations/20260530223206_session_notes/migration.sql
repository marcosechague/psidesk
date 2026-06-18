-- CreateTable
CREATE TABLE "SessionNote" (
    "id" TEXT NOT NULL,
    "patientId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "observations" TEXT NOT NULL,
    "goals" TEXT,
    "nextSteps" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SessionNote_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionNote_patientId_idx" ON "SessionNote"("patientId");

-- AddForeignKey
ALTER TABLE "SessionNote" ADD CONSTRAINT "SessionNote_patientId_fkey" FOREIGN KEY ("patientId") REFERENCES "Patient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
