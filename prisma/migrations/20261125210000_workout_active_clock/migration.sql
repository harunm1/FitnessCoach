-- Workout clock (D37): duration counts active time only. Additive: two columns on "Workout".
-- "activeBankedSeconds" is the active time before the current stretch; "activeSince" is when
-- the running stretch began (NULL while paused or once finished).
-- Rollback: ALTER TABLE "Workout" DROP CONSTRAINT "Workout_activeBankedSeconds_nonnegative",
-- DROP COLUMN "activeSince", DROP COLUMN "activeBankedSeconds";

-- AlterTable
ALTER TABLE "Workout" ADD COLUMN "activeBankedSeconds" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "activeSince" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP;

-- An open workout has been running since it started; a finished or imported one has no
-- running stretch.
UPDATE "Workout" SET "activeSince" = "startedAt" WHERE "finishedAt" IS NULL;
UPDATE "Workout" SET "activeSince" = NULL WHERE "finishedAt" IS NOT NULL;

-- AddCheckConstraint
ALTER TABLE "Workout" ADD CONSTRAINT "Workout_activeBankedSeconds_nonnegative" CHECK ("activeBankedSeconds" >= 0);
