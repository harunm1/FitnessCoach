import exerciseCueData from "./data/exercise-cues.json";

export type ExerciseCueFields = {
  cues: string[];
  commonMistakes: string[];
};

export const EXERCISE_CUE_IDS = Object.keys(exerciseCueData);

export function getMissingExerciseCueIds(
  cueIds: Iterable<string>,
  exerciseIds: Iterable<string>,
): string[] {
  const availableIds = new Set(exerciseIds);
  return [...cueIds].filter((id) => !availableIds.has(id));
}

export function getExerciseCueFields(
  exerciseId: string,
): ExerciseCueFields | undefined {
  if (!Object.hasOwn(exerciseCueData, exerciseId)) return undefined;
  return exerciseCueData[exerciseId as keyof typeof exerciseCueData];
}
