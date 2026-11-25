// How long a workout took (B1). Start to finish only: an unfinished workout has no
// duration (never timed to "now"), a logged run uses the duration it recorded, and a
// gap longer than the cap means the workout was left open and finished much later, so
// the gap is not a workout time and reads as null ("not timed").
export const MAX_WORKOUT_SECONDS = 6 * 60 * 60;

export const NOT_TIMED_LABEL = "Not timed";

type WorkoutTimes = {
  startedAt: Date;
  finishedAt: Date | null;
  durationSeconds: number | null;
};

export function workoutSeconds(workout: WorkoutTimes): number | null {
  if (workout.finishedAt === null) return null;
  if (workout.durationSeconds !== null) return workout.durationSeconds;
  const seconds = Math.round(
    (workout.finishedAt.getTime() - workout.startedAt.getTime()) / 1000,
  );
  if (seconds <= 0 || seconds > MAX_WORKOUT_SECONDS) return null;
  return seconds;
}

// Whole minutes for lists, at least 1, or null when the workout is not timed.
export function workoutMinutes(workout: WorkoutTimes): number | null {
  const seconds = workoutSeconds(workout);
  return seconds === null ? null : Math.max(1, Math.round(seconds / 60));
}

// "45 min", or "Not timed" for a workout left open.
export function minutesLabel(minutes: number | null): string {
  return minutes === null ? NOT_TIMED_LABEL : `${minutes} min`;
}
