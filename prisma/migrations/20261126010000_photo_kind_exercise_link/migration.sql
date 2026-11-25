-- Photo kind and exercise link (D37): a photo is a PROGRESS photo (the default, so
-- every existing row keeps its meaning) or a FORM photo, and a form photo may name
-- the exercise it shows. Additive only: one enum, two columns, one index, one
-- foreign key and one CHECK. Adding a NOT NULL column with a constant default is a
-- metadata-only change on PostgreSQL 11 and later, so no table rewrite.
-- The CHECK is written by hand because Prisma's schema has no CHECK (#76).
-- Rollback: ALTER TABLE "ProgressPhoto" DROP CONSTRAINT "ProgressPhoto_exercise_only_on_form";
--           ALTER TABLE "ProgressPhoto" DROP CONSTRAINT "ProgressPhoto_exerciseId_fkey";
--           DROP INDEX "ProgressPhoto_exerciseId_idx";
--           ALTER TABLE "ProgressPhoto" DROP COLUMN "exerciseId", DROP COLUMN "kind";
--           DROP TYPE "PhotoKind";

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('PROGRESS', 'FORM');

-- AlterTable
ALTER TABLE "ProgressPhoto" ADD COLUMN     "exerciseId" TEXT,
ADD COLUMN     "kind" "PhotoKind" NOT NULL DEFAULT 'PROGRESS';

-- CreateIndex
CREATE INDEX "ProgressPhoto_exerciseId_idx" ON "ProgressPhoto"("exerciseId");

-- AddForeignKey
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "Exercise"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Only a form photo may name an exercise.
ALTER TABLE "ProgressPhoto" ADD CONSTRAINT "ProgressPhoto_exercise_only_on_form"
CHECK ("exerciseId" IS NULL OR "kind" = 'FORM');
