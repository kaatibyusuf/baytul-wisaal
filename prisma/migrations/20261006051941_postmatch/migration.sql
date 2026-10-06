-- AlterTable
ALTER TABLE "Compatibility" ADD COLUMN     "decidedAt" TIMESTAMP(3),
ADD COLUMN     "reasons" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "MatchExpectation" ADD COLUMN     "responsesSubmittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MatchExpectationItem" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;
