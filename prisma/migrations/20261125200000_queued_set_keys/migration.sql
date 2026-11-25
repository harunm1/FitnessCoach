-- Offline set queue (D31): every clientId the queue has applied, one row per key,
-- written in the same transaction as the set. Additive only: a new table, no change to
-- SetLog or any existing row. Removed with its workout (ON DELETE CASCADE).
-- Rollback: DROP TABLE "QueuedSetKey";

-- CreateTable
CREATE TABLE "QueuedSetKey" (
    "workoutId" INTEGER NOT NULL,
    "clientId" TEXT NOT NULL,
    "exerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QueuedSetKey_pkey" PRIMARY KEY ("workoutId","clientId")
);

-- AddForeignKey
ALTER TABLE "QueuedSetKey" ADD CONSTRAINT "QueuedSetKey_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "Workout"("id") ON DELETE CASCADE ON UPDATE CASCADE;
