// The quiz's starting answers, from the history (D34): experience and equipment. The user can
// change both before saving, and a saved answer is never lowered.
import type { QuizAnswers } from "@/lib/onboarding/answers";
import { equipmentOptions } from "@/lib/onboarding/schema";
import type { ExperienceLevel, TrainingProfile } from "./types";

// Fewer logged workouts than this say too little about how the user trains.
export const MIN_WORKOUTS_FOR_PREFILL = 8;
const BODYWEIGHT = "body only";

const RANK: Record<QuizAnswers["level"], number> = {
  "": -1,
  BEGINNER: 0,
  INTERMEDIATE: 1,
  EXPERT: 2,
};

const quizEquipment = new Set<string>(
  equipmentOptions.map((option) => option.value),
);

const higher = (saved: QuizAnswers["level"], found: ExperienceLevel) =>
  RANK[found] > RANK[saved] ? found : saved;

// Equipment the history used and the quiz offers, plus what the user already ticked. A
// bodyweight-only answer is the form's default, so history replaces it.
function mergeEquipment(saved: string[], used: string[]): string[] {
  const offered = used.filter(
    (item) => quizEquipment.has(item) && item !== BODYWEIGHT,
  );
  if (offered.length === 0) return saved;
  const bodyweightOnly =
    saved.length === 0 || (saved.length === 1 && saved[0] === BODYWEIGHT);
  return bodyweightOnly
    ? offered
    : [...saved, ...offered.filter((item) => !saved.includes(item))];
}

export type Prefill = { answers: QuizAnswers; note: string | null };

export function prefillFromHistory(
  saved: QuizAnswers,
  history: TrainingProfile | null,
): Prefill {
  if (history === null || history.workoutCount < MIN_WORKOUTS_FOR_PREFILL) {
    return { answers: saved, note: null };
  }
  const level = higher(saved.level, history.level);
  const equipment = mergeEquipment(saved.equipment, history.equipment);
  const levelChanged = level !== saved.level;
  const equipmentChanged =
    equipment.length !== saved.equipment.length ||
    equipment.some((item, index) => item !== saved.equipment[index]);
  if (!levelChanged && !equipmentChanged) return { answers: saved, note: null };
  const parts = [
    ...(levelChanged ? ["your experience"] : []),
    ...(equipmentChanged ? ["your equipment"] : []),
  ].join(" and ");
  return {
    answers: { ...saved, level, equipment },
    note: `Pre-filled from your ${history.workoutCount} logged workouts: ${parts}. Change anything that is not right before you save.`,
  };
}
