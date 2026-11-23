-- One active plan per user and one open workout per plan as partial unique indexes, plus plain indexes on Workout.planId and Workout.planDayId (#76).
-- CreateIndex
CREATE UNIQUE INDEX "Plan_one_active_per_user" ON "Plan"("userId") WHERE ("active" = true);

-- CreateIndex
CREATE INDEX "Workout_planId_idx" ON "Workout"("planId");

-- CreateIndex
CREATE INDEX "Workout_planDayId_idx" ON "Workout"("planDayId");

-- CreateIndex
CREATE UNIQUE INDEX "Workout_one_open_per_plan" ON "Workout"("planId") WHERE ("finishedAt" IS NULL);

