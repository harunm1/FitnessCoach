// Which muscles a workout worked, for the body map and its statistics (#16).
// Muscle names are the 17 used by the exercise library (free-exercise-db).
export type LoggedSet = {
  category: string; // exercise category: strength, stretching, cardio...
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

// Stretches and cardio list muscles too, but they are not training those muscles.
const SKIPPED_CATEGORIES = new Set(["stretching", "cardio"]);

// The muscles the sets worked. Primary and secondary are kept apart so the map can
// show them differently later; a muscle that is primary anywhere is listed as primary.
export function musclesWorked(sets: LoggedSet[]): {
  primary: string[];
  secondary: string[];
} {
  const primary = new Set<string>();
  const secondary = new Set<string>();
  for (const set of sets) {
    if (SKIPPED_CATEGORIES.has(set.category)) continue;
    set.primaryMuscles.forEach((muscle) => primary.add(muscle));
    set.secondaryMuscles.forEach((muscle) => secondary.add(muscle));
  }
  primary.forEach((muscle) => secondary.delete(muscle));
  return { primary: [...primary].sort(), secondary: [...secondary].sort() };
}

export type MuscleShare = {
  muscle: string;
  workouts: number; // workouts that used the muscle
  share: number; // of all counted workouts, from 0 to 1
};

// For each muscle, how many workouts used it. Workouts that worked no muscle (a run,
// or a stretching session) are left out of the total, so the shares describe
// strength work only. Most used first, then by name.
export function muscleShare(workouts: LoggedSet[][]): MuscleShare[] {
  const counts = new Map<string, number>();
  let counted = 0;
  for (const sets of workouts) {
    const { primary, secondary } = musclesWorked(sets);
    const muscles = [...primary, ...secondary];
    if (muscles.length === 0) continue;
    counted += 1;
    muscles.forEach((muscle) =>
      counts.set(muscle, (counts.get(muscle) ?? 0) + 1),
    );
  }
  return [...counts]
    .map(([muscle, used]) => ({
      muscle,
      workouts: used,
      share: used / counted,
    }))
    .sort(
      (a, b) => b.workouts - a.workouts || a.muscle.localeCompare(b.muscle),
    );
}
