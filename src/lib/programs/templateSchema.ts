// The shape of a program template (D38). Templates are JSON in src/data/programTemplates,
// versioned in git, parsed here at load so a malformed file fails the build's tests,
// not a user's first visit.
import { z } from "zod";
import { LIMITS } from "@/lib/coach/schema";

export const WEEKDAYS = [
  "MON",
  "TUE",
  "WED",
  "THU",
  "FRI",
  "SAT",
  "SUN",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

// His rule (25 Nov 16:45): a template day with fewer than 4 exercises is too thin.
export const MIN_EXERCISES_PER_DAY = 4;

// His call (25 Nov 16:45): a deload is offered every 6 to 8 weeks.
export const DELOAD_WEEKS = { min: 6, max: 8 } as const;

// ACSM 2009 (D38): a 2 to 10% load step when the work is done for 1 to 2 reps over target.
export const LOAD_STEP_PERCENT = { min: 2, max: 10 } as const;

const slotSchema = z.object({
  exerciseId: z.string().min(1),
  sets: z.number().int().min(LIMITS.sets.min).max(LIMITS.sets.max),
  reps: z.number().int().min(LIMITS.reps.min).max(LIMITS.reps.max),
  restSeconds: z
    .number()
    .int()
    .min(LIMITS.restSeconds.min)
    .max(LIMITS.restSeconds.max),
  rpe: z.number().int().min(LIMITS.rpe.min).max(LIMITS.rpe.max),
});

const daySchema = z.object({
  name: z.string().min(1).max(40),
  weekdays: z.array(z.enum(WEEKDAYS)).min(1),
  exercises: z
    .array(slotSchema)
    .min(MIN_EXERCISES_PER_DAY)
    .max(LIMITS.exercisesPerDay.max),
});

export const templateSchema = z
  .object({
    // A slug of lowercase letters, digits and hyphens: "full-body-3" matches,
    // "Full Body" does not.
    id: z.string().regex(/^[a-z0-9-]+$/),
    version: z.number().int().min(1),
    name: z.string().min(1).max(60),
    summary: z.string().min(1).max(300),
    level: z.enum(["BEGINNER", "INTERMEDIATE", "EXPERT"]),
    goals: z
      .array(z.enum(["STRENGTH", "MUSCLE", "FAT_LOSS", "GENERAL_FITNESS"]))
      .min(1),
    daysPerWeek: z
      .number()
      .int()
      .min(LIMITS.daysPerWeek.min)
      .max(LIMITS.daysPerWeek.max),
    // free-exercise-db equipment names the template's exercises need.
    equipment: z.array(z.string().min(1)),
    // The rep band every slot, and every adapted slot, must stay inside.
    repBand: z.object({
      min: z.number().int().min(LIMITS.reps.min),
      max: z.number().int().max(LIMITS.reps.max),
    }),
    progression: z.object({
      kind: z.enum(["linear", "double"]),
      loadStepPercent: z
        .number()
        .min(LOAD_STEP_PERCENT.min)
        .max(LOAD_STEP_PERCENT.max),
      rule: z.string().min(1).max(300),
    }),
    deloadEveryWeeks: z
      .number()
      .int()
      .min(DELOAD_WEEKS.min)
      .max(DELOAD_WEEKS.max),
    days: z.array(daySchema).min(1),
  })
  .refine((t) => t.repBand.min <= t.repBand.max, "repBand min above max");

export type ProgramTemplate = z.infer<typeof templateSchema>;
export type TemplateDay = ProgramTemplate["days"][number];
export type TemplateSlot = TemplateDay["exercises"][number];
