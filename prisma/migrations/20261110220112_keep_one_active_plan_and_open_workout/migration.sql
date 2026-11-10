-- Data only: leaves one active plan per user and one open workout per plan, so the unique indexes in the next migration can be built (#76).

-- The newest active plan of each user stays active; older active plans are deactivated.
UPDATE "Plan" SET "active" = false
WHERE "active"
  AND "id" NOT IN (
    SELECT DISTINCT ON ("userId") "id"
    FROM "Plan"
    WHERE "active"
    ORDER BY "userId", "createdAt" DESC, "id" DESC
  );

-- The newest open workout on each plan stays open. An older open one on the same plan
-- with nothing logged (no set, no run, no distance or time) is a second tap on Start
-- and is deleted, so it does not count as a finished workout and move the user on a
-- day. One with something logged is kept and closed at its start time. A workout
-- without a plan is not constrained.
DELETE FROM "Workout" AS w
WHERE w."finishedAt" IS NULL
  AND w."planId" IS NOT NULL
  AND w."id" NOT IN (
    SELECT DISTINCT ON ("planId") "id"
    FROM "Workout"
    WHERE "finishedAt" IS NULL AND "planId" IS NOT NULL
    ORDER BY "planId", "startedAt" DESC, "id" DESC
  )
  AND w."distanceKm" IS NULL
  AND w."durationSeconds" IS NULL
  AND NOT EXISTS (SELECT 1 FROM "SetLog" s WHERE s."workoutId" = w."id")
  AND NOT EXISTS (SELECT 1 FROM "RunLog" r WHERE r."workoutId" = w."id");

UPDATE "Workout" SET "finishedAt" = "startedAt"
WHERE "finishedAt" IS NULL
  AND "planId" IS NOT NULL
  AND "id" NOT IN (
    SELECT DISTINCT ON ("planId") "id"
    FROM "Workout"
    WHERE "finishedAt" IS NULL AND "planId" IS NOT NULL
    ORDER BY "planId", "startedAt" DESC, "id" DESC
  );
