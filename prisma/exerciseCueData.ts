import exerciseCueData from "./data/exercise-cues.json";

export type ExerciseCueFields = {
  cues: string[];
  commonMistakes: string[];
};

export function getExerciseCueFields(
  exerciseId: string,
): ExerciseCueFields | undefined {
  return exerciseCueData[exerciseId as keyof typeof exerciseCueData];
}
