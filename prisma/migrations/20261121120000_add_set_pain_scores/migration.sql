-- Optional 0-10 pain scores captured during a set and the next morning.
ALTER TABLE "SetLog"
ADD COLUMN "painDuringSession" INTEGER,
ADD COLUMN "painNextMorning" INTEGER;

ALTER TABLE "SetLog"
ADD CONSTRAINT "SetLog_painDuringSession_check"
CHECK ("painDuringSession" IS NULL OR ("painDuringSession" >= 0 AND "painDuringSession" <= 10));

ALTER TABLE "SetLog"
ADD CONSTRAINT "SetLog_painNextMorning_check"
CHECK ("painNextMorning" IS NULL OR ("painNextMorning" >= 0 AND "painNextMorning" <= 10));
