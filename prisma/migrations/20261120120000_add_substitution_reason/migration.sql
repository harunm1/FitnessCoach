-- Add nullable provenance text for joint-aware exercise substitutions.
ALTER TABLE "PlanExercise"
ADD COLUMN "substitutionReason" TEXT;
