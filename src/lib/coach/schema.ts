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
