// Deterministic guardrails for a program built from a template (D38). They run on the
// template as shipped, on the template with the coach's changes applied, and on the
// user's accepted mix of changes before it is saved. No model is involved: every rule
// is code, and every problem is reported, not just the first.
import type { PlanInput } from "@/lib/coach/schema";
import {
  verifyPlan,
  type LibraryExercise,
  type VerifyProfile,
} from "@/lib/coach/verify";
import { MIN_EXERCISES_PER_DAY, type ProgramTemplate } from "./templateSchema";

// Our ceiling, not a sourced number (D38): Schoenfeld et al. 2017 support 10 or more
// weekly sets per muscle for growth but give no upper limit.
export const MAX_WEEKLY_SETS_PER_MUSCLE = 20;

export type GuardContext = {
  template: ProgramTemplate;
  library: Map<string, LibraryExercise>;
  profile: VerifyProfile;
};

// The template as the plan shape the verifier and the save path already use.
export function templateToPlan(template: ProgramTemplate): PlanInput {
  return {
    name: template.name,
    days: template.days.map((day) => ({
      name: day.name,
      exercises: day.exercises.map((slot) => ({ ...slot })),
    })),
  };
}

// Hard sets a week per primary muscle. A plan day trained on two weekdays counts twice;
// a plan without weekdays (an adapted plan before save) counts each day once.
export function weeklySetsByMuscle(
  plan: PlanInput,
  library: Map<string, LibraryExercise>,
  timesPerWeek: (dayIndex: number) => number = () => 1,
): Map<string, number> {
  const totals = new Map<string, number>();
  plan.days.forEach((day, dayIndex) =>
    day.exercises.forEach((slot) =>
      (library.get(slot.exerciseId)?.primaryMuscles ?? []).forEach((muscle) =>
        totals.set(
          muscle,
          (totals.get(muscle) ?? 0) + slot.sets * timesPerWeek(dayIndex),
        ),
      ),
    ),
  );
  return totals;
}

const dayProblems = (plan: PlanInput): string[] =>
  plan.days.flatMap((day, i) =>
    day.exercises.length < MIN_EXERCISES_PER_DAY
      ? [
          `day ${i + 1} (${day.name}): fewer than ${MIN_EXERCISES_PER_DAY} exercises`,
        ]
      : [],
  );

const repProblems = (plan: PlanInput, template: ProgramTemplate): string[] => {
  const { min, max } = template.repBand;
  return plan.days.flatMap((day, i) =>
    day.exercises
      .filter((slot) => slot.reps < min || slot.reps > max)
      .map(
        (slot) =>
          `day ${i + 1} (${day.name}), ${slot.exerciseId}: ${slot.reps} reps is outside the ${min} to ${max} rep band`,
      ),
  );
};

const volumeProblems = (plan: PlanInput, ctx: GuardContext): string[] => {
  const times = (i: number) => ctx.template.days[i]?.weekdays.length ?? 1;
  return [...weeklySetsByMuscle(plan, ctx.library, times)]
    .filter(([, sets]) => sets > MAX_WEEKLY_SETS_PER_MUSCLE)
    .map(
      ([muscle, sets]) =>
        `${muscle}: ${sets} sets a week is above the ${MAX_WEEKLY_SETS_PER_MUSCLE}-set ceiling`,
    );
};

export function checkProgram(plan: PlanInput, ctx: GuardContext): string[] {
  // verifyPlan checks the shape and ranges (zod), the library, equipment, injuries,
  // joints and duplicates; the day count must match the template, not the quiz.
  const verified = verifyPlan(
    plan,
    { ...ctx.profile, daysPerWeek: ctx.template.days.length },
    ctx.library,
  );
  const base = verified.ok ? [] : verified.problems;
  return [
    ...base,
    ...dayProblems(plan),
    ...repProblems(plan, ctx.template),
    ...volumeProblems(plan, ctx),
  ];
}
