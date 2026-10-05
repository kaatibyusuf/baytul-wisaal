-- CreateEnum
CREATE TYPE "Availability" AS ENUM ('AVAILABLE', 'PAUSED');

-- AlterTable
ALTER TABLE "PreferenceSet" ADD COLUMN     "availability" "Availability" NOT NULL DEFAULT 'AVAILABLE',
ADD COLUMN     "availableAfter" TIMESTAMP(3),
ADD COLUMN     "questionnaireVersion" INTEGER,
ADD COLUMN     "selfAnswers" JSONB,
ADD COLUMN     "submittedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "country" TEXT,
ADD COLUMN     "region" TEXT;
