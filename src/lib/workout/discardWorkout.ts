// Discarding an unfinished workout (D47): removes it and, through the schema's cascade, its
// sets and run. Scoped to the owner and to a workout that is not finished.
type WorkoutDeleter = {
  workout: {
    deleteMany(args: {
      where: { id: number; userId: string; finishedAt: null };
    }): Promise<{ count: number }>;
  };
};

// True when a workout was removed; false for a missing, finished or another user's workout,
// which the caller answers the same way.
export async function discardOpenWorkout(
  db: WorkoutDeleter,
  userId: string,
  workoutId: number,
): Promise<boolean> {
  const { count } = await db.workout.deleteMany({
    where: { id: workoutId, userId, finishedAt: null },
  });
  return count > 0;
}
