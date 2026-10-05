-- CreateEnum
CREATE TYPE "EvalState" AS ENUM ('NONE', 'PENDING', 'DONE', 'REVIEW');

-- AlterEnum
ALTER TYPE "IntegrityEventType" ADD VALUE 'QUESTION_SERVED';

-- AlterEnum
ALTER TYPE "SessionStatus" ADD VALUE 'EVALUATED';

-- AlterTable
ALTER TABLE "AIEvaluation" ADD COLUMN     "isAggregate" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "AssessmentAnswer" ADD COLUMN     "parts" JSONB;

-- AlterTable
ALTER TABLE "AssessmentSession" ADD COLUMN     "activityId" TEXT,
ADD COLUMN     "evalAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "evalError" TEXT,
ADD COLUMN     "evalState" "EvalState" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "evaluatedAt" TIMESTAMP(3),
ADD COLUMN     "lastSeenAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "HumanReview" ADD COLUMN     "triggers" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE INDEX "AssessmentSession_userId_activityId_idx" ON "AssessmentSession"("userId", "activityId");

-- CreateIndex
CREATE INDEX "AssessmentSession_evalState_idx" ON "AssessmentSession"("evalState");
