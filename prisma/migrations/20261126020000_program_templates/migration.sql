-- CreateEnum
CREATE TYPE "Weekday" AS ENUM ('MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN');

-- AlterEnum
ALTER TYPE "PlanSource" ADD VALUE 'TEMPLATE';

-- AlterTable
ALTER TABLE "Plan" ADD COLUMN     "templateId" TEXT,
ADD COLUMN     "templateVersion" INTEGER;

-- AlterTable
ALTER TABLE "PlanDay" ADD COLUMN     "weekdays" "Weekday"[] DEFAULT ARRAY[]::"Weekday"[];
