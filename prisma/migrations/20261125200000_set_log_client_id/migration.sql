-- Offline set queue (D31): the device's idempotency key for each queued set.
-- Additive only: a nullable column with no default (no table rewrite, existing rows keep
-- NULL) and a unique index on (workoutId, clientId). NULLs never collide in PostgreSQL,
-- so rows logged before the queue are unaffected. SetLog is small, so the index is built
-- inside Prisma's migration transaction rather than CONCURRENTLY.
-- Rollback: DROP INDEX "SetLog_workoutId_clientId_key"; ALTER TABLE "SetLog" DROP COLUMN "clientId";

-- AlterTable
ALTER TABLE "SetLog" ADD COLUMN     "clientId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "SetLog_workoutId_clientId_key" ON "SetLog"("workoutId", "clientId");
