// What the seed stores as form guidance for one exercise (#193, D45): the curated cues
// when the exercise has them, otherwise the dataset's instructions, otherwise the short
// cues we wrote for the few rows the dataset ships without instructions.
import fallbackCues from "./data/exercise-guidance-fallback.json";
import {
  guidanceForSeed,
  hasGuidance,
  type ExerciseGuidance,
} from "../src/lib/exercises/guidance";
import { getExerciseCueFields } from "./exerciseCueData";

export const FALLBACK_CUE_IDS = Object.keys(fallbackCues);

function fallbackFor(exerciseId: string): readonly string[] | undefined {
  return Object.hasOwn(fallbackCues, exerciseId)
    ? fallbackCues[exerciseId as keyof typeof fallbackCues]
    : undefined;
}

// The seed's guard: ids of rows that would be stored with no guidance at all.
export const exercisesWithoutGuidance = (
  rows: readonly { id: string; instructions: readonly string[] }[],
): string[] =>
  rows
    .filter((r) => !hasGuidance(guidanceForExercise(r.id, r.instructions)))
    .map((r) => r.id);

export function guidanceForExercise(
  exerciseId: string,
  instructions: readonly string[],
): ExerciseGuidance {
  return guidanceForSeed({
    curated: getExerciseCueFields(exerciseId),
    instructions,
    fallbackCues: fallbackFor(exerciseId),
  });
}
