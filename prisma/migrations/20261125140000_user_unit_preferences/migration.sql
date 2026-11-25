-- Display units (D30). Additive only: two enums and two columns with a default, so existing
-- rows get LB and KM, old code that never names the columns keeps working, and nothing is
-- renamed or dropped. Stored weights stay kg and distances km.
CREATE TYPE "WeightUnit" AS ENUM ('KG', 'LB');
CREATE TYPE "DistanceUnit" AS ENUM ('KM', 'MI');

ALTER TABLE "User"
  ADD COLUMN "weightUnit" "WeightUnit" NOT NULL DEFAULT 'LB',
  ADD COLUMN "distanceUnit" "DistanceUnit" NOT NULL DEFAULT 'KM';
