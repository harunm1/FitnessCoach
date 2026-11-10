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

-- The newest open workout on each plan stays open; older open ones on the same plan
-- are closed at their start time. A workout without a plan is not constrained.
UPDATE "Workout" SET "finishedAt" = "startedAt"
WHERE "finishedAt" IS NULL
  AND "planId" IS NOT NULL
  AND "id" NOT IN (
    SELECT DISTINCT ON ("planId") "id"
    FROM "Workout"
    WHERE "finishedAt" IS NULL AND "planId" IS NOT NULL
    ORDER BY "planId", "startedAt" DESC, "id" DESC
  );
