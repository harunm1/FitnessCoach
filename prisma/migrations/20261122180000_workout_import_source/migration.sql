-- Imported workouts (#131): where a workout came from, and a key that makes a re-upload add nothing.
-- AlterTable
ALTER TABLE "Workout" ADD COLUMN     "importKey" TEXT,
ADD COLUMN     "source" TEXT NOT NULL DEFAULT 'live';

-- CreateIndex
CREATE UNIQUE INDEX "Workout_userId_importKey_key" ON "Workout"("userId", "importKey");
