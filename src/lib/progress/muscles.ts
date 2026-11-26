// Which muscles a workout worked, for the body map and its statistics (#16).
// Muscle names are the 17 used by the exercise library (free-exercise-db).
export type LoggedSet = {
  exerciseName?: string; // lets a few pulling exercises count toward traps (live bug L2)
  category: string; // exercise category: strength, stretching, cardio...
  primaryMuscles: string[];
  secondaryMuscles: string[];
};

// Stretches and cardio list muscles too, but they are not training those muscles.
const SKIPPED_CATEGORIES = new Set(["stretching", "cardio"]);

// The library lists no traps for face pulls, rows or pulldowns, but they work them (his spec,
// live feedback 25 Nov 2026), so these name families count traps as a secondary muscle.
const TRAPS_FROM_NAME = /\b(face pulls?|rows?|pulldowns?)\b/i;

function secondaryFor(set: LoggedSet): string[] {
  const addsTraps =
    set.exerciseName !== undefined && TRAPS_FROM_NAME.test(set.exerciseName);
  return addsTraps ? [...set.secondaryMuscles, "traps"] : set.secondaryMuscles;
}

// Strength exercises that name no muscle: they would count as nothing on the map, so the
// page lists them as unmapped instead (live bug L2). Once each, sorted.
export function unmappedExercises(sets: LoggedSet[]): string[] {
  const names = new Set<string>();
  for (const set of sets) {
    if (SKIPPED_CATEGORIES.has(set.category)) continue;
    if (set.primaryMuscles.length + set.secondaryMuscles.length > 0) continue;
    names.add(set.exerciseName ?? "Unnamed exercise");
  }
  return [...names].sort();
}

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
    secondaryFor(set).forEach((muscle) => secondary.add(muscle));
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
// or only stretching or cardio) are left out of the total, so the shares describe
// muscle work: every category except stretching and cardio. Most used first, then
// by name.
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
