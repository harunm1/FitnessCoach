// The JSON shape the coach must return for a plan. One schema, used in three places:
// to parse the model's output, to type the verifier, and later as the AI SDK's
// structured-output schema (docs/RESEARCH.md, section 3). Validation at the
// boundary, as in Lecture 4 pp. 17 to 23: the model's reply is external input.
import { z } from "zod";

// Coaching ranges. These are decisions, not database constraints, so they live here.
export const LIMITS = {
  sets: { min: 1, max: 6 },
  reps: { min: 1, max: 30 },
  restSeconds: { min: 30, max: 300 },
  // Target effort per exercise (#65), on the reps-in-reserve RPE scale (Helms et al.
  // 2016, Strength Cond J 38(4), Table 1: 10 = max, 9 = 1 rep left, 7 = 3 left): 6 to 9
  // is hard enough to train, never a true max. Validated here, not stored: PlanExercise
  // has no rpe column and the issue asks for no migration.
  rpe: { min: 6, max: 9 },
  exercisesPerDay: { min: 2, max: 8 },
  daysPerWeek: { min: 1, max: 7 },
} as const;

export const planExerciseSchema = z.object({
  exerciseId: z.string().min(1), // must exist in our Exercise table; the verifier checks
  sets: z.number().int().min(LIMITS.sets.min).max(LIMITS.sets.max),
  reps: z.number().int().min(LIMITS.reps.min).max(LIMITS.reps.max),
  restSeconds: z
    .number()
    .int()
    .min(LIMITS.restSeconds.min)
    .max(LIMITS.restSeconds.max),
  rpe: z.number().int().min(LIMITS.rpe.min).max(LIMITS.rpe.max),
});

export const planDaySchema = z.object({
  name: z.string().min(1).max(40),
  exercises: z
    .array(planExerciseSchema)
    .min(LIMITS.exercisesPerDay.min)
    .max(LIMITS.exercisesPerDay.max),
});

export const planSchema = z.object({
  name: z.string().min(1).max(60),
  days: z
    .array(planDaySchema)
    .min(LIMITS.daysPerWeek.min)
    .max(LIMITS.daysPerWeek.max),
});

export type PlanExerciseInput = z.infer<typeof planExerciseSchema>;
export type PlanDayInput = z.infer<typeof planDaySchema>;
export type PlanInput = z.infer<typeof planSchema>;

// Running plans (#34). A running week is a list of run days; each day carries one
// session. Pace is optional because a new runner has no pace yet; distance is not.
export const RUN_TYPES = [
  "EASY",
  "TEMPO",
  "INTERVALS",
  "HILLS",
  "LONG",
] as const;

export const RUN_LIMITS = {
  distanceKm: { min: 1, max: 42.2 },
  paceSecPerKm: { min: 150, max: 600 }, // 2:30 to 10:00 per km
  // Week-to-week growth the verifier allows (the common 10% rule).
  weeklyIncrease: 0.1,
} as const;

export const runSessionSchema = z.object({
  type: z.enum(RUN_TYPES),
  distanceKm: z
    .number()
    .min(RUN_LIMITS.distanceKm.min)
    .max(RUN_LIMITS.distanceKm.max),
  targetPaceSecPerKm: z
    .number()
    .int()
    .min(RUN_LIMITS.paceSecPerKm.min)
    .max(RUN_LIMITS.paceSecPerKm.max)
    .nullable(),
});

export const runDaySchema = z.object({
  name: z.string().min(1).max(40),
  run: runSessionSchema,
});

export const runningPlanSchema = z.object({
  name: z.string().min(1).max(60),
  days: z
    .array(runDaySchema)
    .min(LIMITS.daysPerWeek.min)
    .max(LIMITS.daysPerWeek.max),
});

export type RunType = (typeof RUN_TYPES)[number];
export type RunSessionInput = z.infer<typeof runSessionSchema>;
export type RunningPlanInput = z.infer<typeof runningPlanSchema>;
