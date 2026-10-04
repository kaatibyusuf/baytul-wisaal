-- AlterTable
ALTER TABLE "ActivityProgress" ADD COLUMN     "startedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ActivitySubmission" (
    "id" TEXT NOT NULL,
    "progressId" TEXT NOT NULL,
    "attempt" INTEGER NOT NULL,
    "data" JSONB NOT NULL,
    "score" INTEGER,
    "passed" BOOLEAN,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivitySubmission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActivitySubmission_progressId_attempt_key" ON "ActivitySubmission"("progressId", "attempt");

-- AddForeignKey
ALTER TABLE "ActivitySubmission" ADD CONSTRAINT "ActivitySubmission_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "ActivityProgress"("id") ON DELETE CASCADE ON UPDATE CASCADE;
