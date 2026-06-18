-- AlterTable
ALTER TABLE "Test" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "showResultsToPatient" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "userId" TEXT,
ALTER COLUMN "code" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "Test_userId_idx" ON "Test"("userId");

-- AddForeignKey
ALTER TABLE "Test" ADD CONSTRAINT "Test_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
