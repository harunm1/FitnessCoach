// The warm-up slot of a starter plan (#145, D25 in docs/ARCHITECTURE.md): one dynamic
// stretching exercise at the head of a strength day, chosen by the day's lead muscle.
// A plan slot has no duration, so it is an ordinary slot with one light set.
import {
  fitsProfile,
  type CategorisedExercise,
  type VerifyProfile,
} from "./verify";
import { LIMITS, type PlanExerciseInput } from "./schema";

// free-exercise-db ids (dist/exercises.json, read 24 Nov 2026). Only dynamic moves are
// listed: most of the 123 stretching entries are static holds (judged by name), a poor way to start a lift.
const UPPER_PUSH = ["Dynamic_Chest_Stretch", "Arm_Circles", "Shoulder_Circles"];
const UPPER_PULL = ["Dynamic_Back_Stretch", "Arm_Circles", "Shoulder_Circles"];
const SHOULDERS = ["Arm_Circles", "Shoulder_Circles"];
const LOWER = ["Standing_Hip_Circles", "Hip_Circles_prone", "Knee_Circles"];

// Candidates in order of preference, by the lead muscle of the day's first lift.
const WARMUP_BY_MUSCLE: Record<string, string[]> = {
  chest: UPPER_PUSH,
  shoulders: SHOULDERS,
  triceps: UPPER_PUSH,
  "middle back": UPPER_PULL,
  lats: UPPER_PULL,
  biceps: UPPER_PULL,
  quadriceps: LOWER,
  hamstrings: LOWER,
  glutes: LOWER,
  "lower back": LOWER,
};

// One light set of ten, at the shortest rest and lowest effort the schema allows.
export const WARMUP_PRESCRIPTION = {
  sets: 1,
  reps: 10,
  restSeconds: LIMITS.restSeconds.min,
  rpe: LIMITS.rpe.min,
} as const;

// The warm-up for a day led by `leadMuscle`, or undefined when no listed exercise is in the
// library and fits the user's equipment and injuries (the day then simply has none).
export function pickWarmup(
  library: CategorisedExercise[],
  profile: VerifyProfile,
  leadMuscle: string | undefined,
): PlanExerciseInput | undefined {
  const candidates = WARMUP_BY_MUSCLE[leadMuscle ?? ""] ?? [];
  const match = candidates
    .map((id) =>
      library.find(
        (e) =>
          e.id === id &&
          e.category?.toLowerCase() === "stretching" &&
          fitsProfile(e, profile),
      ),
    )
    .find((e) => e !== undefined);
  return match && { exerciseId: match.id, ...WARMUP_PRESCRIPTION };
}
