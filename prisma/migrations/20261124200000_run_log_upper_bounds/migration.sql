-- Upper bounds on a logged run (D27), written by hand because CHECK is not in the
-- Prisma schema. The lower bounds (above 0, effort 1 to 10) are in
-- 20261124180300_range_checks. The same numbers are in src/lib/progress/runLimits.ts.
-- RunLog had no writer before D27, so no existing row can fail these.

ALTER TABLE "RunLog"
  ADD CONSTRAINT "RunLog_distanceKm_max_check" CHECK ("distanceKm" <= 300),
  ADD CONSTRAINT "RunLog_durationSec_max_check" CHECK ("durationSec" <= 86400);
