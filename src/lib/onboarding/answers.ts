// Helpers for the quiz form's answers (#138, #143): the saved answers shown again after saving,
// Bodyweight as an exclusive choice, and the sentence that states how the days are split.
import {
  splitDays,
  type Goal,
  type TrainingMode,
} from "@/lib/coach/hybridWeek";

const BODYWEIGHT = "body only";

export type QuizAnswers = {
  goal: Goal;
  level: "" | "BEGINNER" | "INTERMEDIATE" | "EXPERT";
  trainingMode: TrainingMode;
  daysPerWeek: number;
  equipment: string[];
  injuries: string;
};

// What a user with no saved profile sees. No experience level is chosen on purpose, so
// the plan is never built from a level the user did not pick.
export const DEFAULT_ANSWERS: QuizAnswers = {
  goal: "STRENGTH",
  level: "",
  trainingMode: "GYM",
  daysPerWeek: 3,
  equipment: [BODYWEIGHT],
  injuries: "",
};

// Bodyweight is the "no equipment" answer, so it cannot be ticked together with other items:
// ticking it clears the rest, and ticking anything else clears it.
export function toggleEquipment(
  current: string[],
  value: string,
  checked: boolean,
): string[] {
  if (!checked) return current.filter((item) => item !== value);
  if (value === BODYWEIGHT) return [BODYWEIGHT];
  const others = current.filter((item) => item !== BODYWEIGHT);
  return others.includes(value) ? others : [...others, value];
}

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

// How the days per week become strength and run days, from the same rule the plan is
// built with, so the sentence shown before saving is what saving does.
export function splitSentence(
  daysPerWeek: number,
  goal: Goal,
  mode: TrainingMode,
): string {
  const { strengthDays, runDays } = splitDays(daysPerWeek, goal, mode);
  return [
    ...(strengthDays > 0 ? [plural(strengthDays, "strength day")] : []),
    ...(runDays > 0 ? [plural(runDays, "run day")] : []),
  ].join(" and ");
}

export function answersFromProfile(
  profile: {
    goal: Goal;
    level: "BEGINNER" | "INTERMEDIATE" | "EXPERT";
    trainingMode: TrainingMode;
    daysPerWeek: number;
    equipment: string[];
    injuries: string | null;
  } | null,
): QuizAnswers {
  if (!profile) return DEFAULT_ANSWERS;
  return { ...profile, injuries: profile.injuries ?? "" };
}
