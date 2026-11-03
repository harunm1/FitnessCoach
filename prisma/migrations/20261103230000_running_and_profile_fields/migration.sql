-- CreateEnum
CREATE TYPE "TrainingMode" AS ENUM ('GYM', 'RUNNING', 'BOTH');

-- CreateEnum
CREATE TYPE "ActivityLevel" AS ENUM ('SEDENTARY', 'LIGHT', 'ACTIVE', 'PHYSICAL_JOB');

-- CreateEnum
CREATE TYPE "DayKind" AS ENUM ('STRENGTH', 'RUN', 'REST');

-- CreateEnum
CREATE TYPE "RunType" AS ENUM ('EASY', 'TEMPO', 'INTERVALS', 'HILLS', 'LONG');

-- AlterTable
ALTER TABLE "Profile" ADD COLUMN     "activityLevel" "ActivityLevel" NOT NULL DEFAULT 'LIGHT',
ADD COLUMN     "occupation" TEXT,
ADD COLUMN     "trainingMode" "TrainingMode" NOT NULL DEFAULT 'GYM';

-- AlterTable
ALTER TABLE "PlanDay" ADD COLUMN     "kind" "DayKind" NOT NULL DEFAULT 'STRENGTH';

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "bodyRegion" TEXT,
ADD COLUMN     "exerciseId" TEXT;

-- CreateTable
CREATE TABLE "PlanRun" (
    "id" SERIAL NOT NULL,
    "planDayId" INTEGER NOT NULL,
    "type" "RunType" NOT NULL,
    "distanceKm" DECIMAL(5,2) NOT NULL,
    "targetPaceSecPerKm" INTEGER,

    CONSTRAINT "PlanRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RunLog" (
    "id" SERIAL NOT NULL,
    "workoutId" INTEGER NOT NULL,
    "type" "RunType",
    "distanceKm" DECIMAL(5,2) NOT NULL,
    "durationSec" INTEGER NOT NULL,
    "rpe" INTEGER,
    "loggedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RunLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanRun_planDayId_key" ON "PlanRun"("planDayId");

-- CreateIndex
CREATE UNIQUE INDEX "RunLog_workoutId_key" ON "RunLog"("workoutId");

-- AddForeignKey
ALTER TABLE "PlanRun" ADD CONSTRAINT "PlanRun_planDayId_fkey" FOREIGN KEY ("planDayId") REFERENCES "PlanDay"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RunLog" ADD CONSTRAINT "RunLog_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

