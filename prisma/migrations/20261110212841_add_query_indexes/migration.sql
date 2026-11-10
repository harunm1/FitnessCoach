-- Indexes for the session queries on Plan and Workout (#76).
-- CreateIndex
CREATE INDEX "Plan_userId_active_createdAt_idx" ON "Plan"("userId", "active", "createdAt");

-- CreateIndex
CREATE INDEX "Workout_userId_planId_finishedAt_idx" ON "Workout"("userId", "planId", "finishedAt");
