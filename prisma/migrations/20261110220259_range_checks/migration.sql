-- Range checks on coaching and logging numbers, written by hand because CHECK is "Not yet" in the Prisma schema and Prisma Migrate (#76).
-- Sanity bounds only; the coaching ranges stay in src/lib/coach/schema.ts. A NULL
-- passes a CHECK, so optional columns (rpe, weightKg, targetPaceSecPerKm) stay optional.
-- A plain ADD CONSTRAINT checks every existing row while it holds the table lock,
-- which is instant on demo data. On a large table, add the constraint NOT VALID here
-- and run VALIDATE CONSTRAINT in a separate migration, since one migration file runs
-- as one transaction. Workout's own columns are not constrained here (a draft for
-- their owner).

ALTER TABLE "SetLog"
  ADD CONSTRAINT "SetLog_setNumber_check" CHECK ("setNumber" >= 1),
  ADD CONSTRAINT "SetLog_reps_check" CHECK ("reps" >= 0),
  ADD CONSTRAINT "SetLog_rpe_check" CHECK ("rpe" BETWEEN 1 AND 10),
  ADD CONSTRAINT "SetLog_weightKg_check" CHECK ("weightKg" >= 0);

ALTER TABLE "RunLog"
  ADD CONSTRAINT "RunLog_distanceKm_check" CHECK ("distanceKm" > 0),
  ADD CONSTRAINT "RunLog_durationSec_check" CHECK ("durationSec" > 0),
  ADD CONSTRAINT "RunLog_rpe_check" CHECK ("rpe" BETWEEN 1 AND 10);

ALTER TABLE "PlanExercise"
  ADD CONSTRAINT "PlanExercise_sets_check" CHECK ("sets" >= 1),
  ADD CONSTRAINT "PlanExercise_reps_check" CHECK ("reps" >= 1),
  ADD CONSTRAINT "PlanExercise_restSeconds_check" CHECK ("restSeconds" >= 0),
  ADD CONSTRAINT "PlanExercise_order_check" CHECK ("order" >= 0);

ALTER TABLE "PlanRun"
  ADD CONSTRAINT "PlanRun_distanceKm_check" CHECK ("distanceKm" > 0),
  ADD CONSTRAINT "PlanRun_targetPaceSecPerKm_check" CHECK ("targetPaceSecPerKm" > 0);

ALTER TABLE "PlanDay"
  ADD CONSTRAINT "PlanDay_dayIndex_check" CHECK ("dayIndex" BETWEEN 0 AND 6);

ALTER TABLE "Profile"
  ADD CONSTRAINT "Profile_daysPerWeek_check" CHECK ("daysPerWeek" BETWEEN 1 AND 7);
