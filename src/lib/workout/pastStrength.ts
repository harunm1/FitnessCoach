// Checks a strength workout logged after the fact (D49, #194): the day (today or earlier),
// the exercises and their sets, optional minutes and a note. Weights are typed in the unit
// the user chose and checked and stored in kilograms, with the same limits as a live set.
import { z } from "zod";
import { EARLIEST_RUN_DAY } from "@/lib/progress/runLimits";
import { isCalendarDay } from "@/lib/progress/weight";
import { weightFieldToKg } from "@/lib/units/input";
import type { WeightUnit } from "@/lib/units/convert";
import { setLogSchema } from "./setLogSchema";

export const MAX_PAST_EXERCISES = 15;
export const MAX_PAST_SETS = 10;
export const MAX_PAST_REPS = 30; // as a set logged live
export const MAX_PAST_MINUTES = 360;
export const MAX_PAST_NOTE_LENGTH = 300;

const DATE_MESSAGE = "Choose the day you trained.";
const REPS_MESSAGE = `Reps are a whole number from 1 to ${MAX_PAST_REPS}.`;
const MINUTES_MESSAGE = `Minutes are a whole number from 1 to ${MAX_PAST_MINUTES}.`;

const setSchema = z.object({
  reps: z.coerce
    .number({ error: REPS_MESSAGE })
    .int(REPS_MESSAGE)
    .min(1, REPS_MESSAGE)
    .max(MAX_PAST_REPS, REPS_MESSAGE),
  // Same checks and messages as a set logged live.
  weightKg: setLogSchema.shape.weightKg,
});

const exerciseSchema = z.object({
  exerciseId: z.string().trim().min(1, "Choose an exercise for each block."),
  sets: z
    .array(setSchema)
    .min(1, "Add at least one set to each exercise.")
    .max(MAX_PAST_SETS, `Log up to ${MAX_PAST_SETS} sets of one exercise.`),
});

// Blank means not given; otherwise digits only: "50" is read; "1e1", "+5" and "1.5" are refused.
const DIGITS_ONLY = /^\d+$/;
const minutesSchema = z
  .string()
  .optional()
  .transform((text) => (!text?.trim() ? null : text.trim()))
  .refine((text) => text === null || DIGITS_ONLY.test(text), MINUTES_MESSAGE)
  .transform((text) => (text === null ? null : Number(text)))
  .refine(
    (minutes) =>
      minutes === null || (minutes >= 1 && minutes <= MAX_PAST_MINUTES),
    MINUTES_MESSAGE,
  );

const noteSchema = z
  .string()
  .optional()
  .transform((text) => text?.trim() || null)
  .refine(
    // Array.from counts characters, as Postgres char_length does, not UTF-16 units.
    (text) => text === null || Array.from(text).length <= MAX_PAST_NOTE_LENGTH,
    `Keep the note to ${MAX_PAST_NOTE_LENGTH} characters.`,
  );

function entrySchema(today: string) {
  return z
    .object({
      date: z
        .string({ error: DATE_MESSAGE })
        .refine(isCalendarDay, DATE_MESSAGE)
        // YYYY-MM-DD strings sort the same way as the days they name.
        .refine((day) => day >= EARLIEST_RUN_DAY, "Choose a day from 2000 on.")
        .refine((day) => day <= today, "That day hasn't happened yet."),
      minutes: minutesSchema,
      note: noteSchema,
      exercises: z
        .array(exerciseSchema)
        .min(1, "Add at least one exercise.")
        .max(
          MAX_PAST_EXERCISES,
          `Log up to ${MAX_PAST_EXERCISES} exercises in one workout.`,
        ),
    })
    .refine(
      ({ exercises }) =>
        new Set(exercises.map((exercise) => exercise.exerciseId)).size ===
        exercises.length,
      {
        path: ["exercises"],
        message: "List each exercise once and add its sets under it.",
      },
    );
}

export type PastStrengthEntry = {
  date: string; // "2026-11-24"
  minutes: number | null;
  note: string | null;
  exercises: {
    exerciseId: string;
    sets: { reps: number; weightKg?: number }[];
  }[];
};

export type PastStrengthParse =
  { ok: true; value: PastStrengthEntry } | { ok: false; message: string };

const NOT_AN_ENTRY = "Your workout couldn't be read. Try again.";

// A set's typed weight, converted to kilograms before the shared checks run.
function inKg(raw: unknown, unit: WeightUnit): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  const { exercises, ...rest } = raw as { exercises?: unknown };
  if (!Array.isArray(exercises)) return raw;
  return {
    ...rest,
    exercises: exercises.map((exercise: unknown) => {
      if (typeof exercise !== "object" || exercise === null) return exercise;
      const { sets, ...other } = exercise as { sets?: unknown };
      if (!Array.isArray(sets)) return exercise;
      return {
        ...other,
        sets: sets.map((set: unknown) =>
          typeof set === "object" && set !== null
            ? {
                ...set,
                weightKg: weightFieldToKg(
                  (set as { weight?: unknown }).weight,
                  unit,
                ),
              }
            : set,
        ),
      };
    }),
  };
}

// `today` is the user's current day ("2026-11-26"); a later day is refused.
export function parsePastStrength(
  raw: unknown,
  today: string,
  unit: WeightUnit,
): PastStrengthParse {
  const result = entrySchema(today).safeParse(inKg(raw, unit));
  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message ?? NOT_AN_ENTRY,
    };
  }
  return { ok: true, value: result.data };
}
