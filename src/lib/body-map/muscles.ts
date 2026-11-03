export type BodyMapExercise = {
  id: string;
  name: string;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  instructions: string[];
};

export const BODY_MAP_MUSCLE_NAMES = [
  "shoulders",
  "chest",
  "biceps",
  "triceps",
  "forearms",
  "abdominals",
  "middle back",
  "lats",
  "lower back",
  "quadriceps",
  "glutes",
  "hamstrings",
  "calves",
] as const;

export function findExercisesForMuscle(
  muscle: string,
  exercises: BodyMapExercise[],
): BodyMapExercise[] {
  const target = muscle.trim().toLowerCase();

  return exercises
    .filter((exercise) =>
      [...exercise.primaryMuscles, ...exercise.secondaryMuscles].some(
        (name) => name.trim().toLowerCase() === target,
      ),
    )
    .sort((left, right) => {
      const leftPrimary = left.primaryMuscles.some(
        (name) => name.trim().toLowerCase() === target,
      );
      const rightPrimary = right.primaryMuscles.some(
        (name) => name.trim().toLowerCase() === target,
      );

      return (
        Number(rightPrimary) - Number(leftPrimary) ||
        left.name.localeCompare(right.name)
      );
    });
}
