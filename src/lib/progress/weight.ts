import { z } from "zod";

import {
  weightBounds,
  weightLabel,
  type WeightUnit,
} from "@/lib/units/convert";
import {
  EARLIEST_DAY,
  MAX_NOTE_LENGTH,
  MAX_WEIGHT_KG,
  MIN_WEIGHT_KG,
} from "./weightLimits";

// The limits are kilograms; the message names them in the unit the user typed in (D29).
function weightMessage(unit: WeightUnit) {
  const [min, max] = weightBounds(MIN_WEIGHT_KG, MAX_WEIGHT_KG, unit);
  return `Enter a weight between ${min} and ${max} ${weightLabel(unit)}.`;
}
const DATE_MESSAGE = "Choose the day you weighed yourself.";

export type WeightEntry = {
  date: string; // "2026-11-24"
  weightKg: number;
  note: string | null;
};

export type WeightParse =
  { ok: true; value: WeightEntry } | { ok: false; message: string };

// The database keeps weights to 0.01 kg (Decimal(5,2)).
const STEPS_PER_KG = 100;

// True for a real calendar day written as YYYY-MM-DD (so not 30 February).
export function isCalendarDay(text: string): boolean {
  // Four, two and two digits joined by hyphens: "2026-11-24" passes the shape,
  // "24/11/2026" and "2026-1-5" do not; the date check below rejects "2026-02-30".
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

// Up to three digits, then optionally a "." or "," and more digits (rounded below):
// "81.5" and "81,5" (some keyboards) pass; "0x50", "1e2" and "81.5.2" do not,
// though Number() would read the first two as 80 and 100.
const WEIGHT_TEXT = /^\d{1,3}([.,]\d+)?$/;

function weightSchema(unit: WeightUnit) {
  const message = weightMessage(unit);
  return z
    .string({ error: message })
    .trim()
    .transform((text) =>
      WEIGHT_TEXT.test(text) ? Number(text.replace(",", ".")) : Number.NaN,
    )
    .pipe(
      z
        .number({ error: message })
        .min(MIN_WEIGHT_KG, message)
        .max(MAX_WEIGHT_KG, message),
    )
    .transform((kg) => Math.round(kg * STEPS_PER_KG) / STEPS_PER_KG);
}

const noteSchema = z
  .string()
  .optional()
  .transform((text) => text?.trim() || null)
  .refine(
    // Array.from counts characters, as Postgres char_length does, not UTF-16 units.
    (text) => text === null || Array.from(text).length <= MAX_NOTE_LENGTH,
    `Keep the note to ${MAX_NOTE_LENGTH} characters.`,
  );

function entrySchema(today: string, unit: WeightUnit) {
  return z.object({
    date: z
      .string({ error: DATE_MESSAGE })
      .refine(isCalendarDay, DATE_MESSAGE)
      // YYYY-MM-DD strings sort the same way as the days they name.
      .refine((day) => day >= EARLIEST_DAY, "Choose a day from 2000 on.")
      .refine((day) => day <= today, "That day hasn't happened yet."),
    weightKg: weightSchema(unit),
    note: noteSchema,
  });
}

// Checks one weigh-in from the form. `today` is the user's current day
// ("2026-11-24"), so a later day is refused.
export function parseWeightEntry(
  fields: { date: unknown; weightKg: unknown; note: unknown },
  today: string,
  unit: WeightUnit = "KG",
): WeightParse {
  const result = entrySchema(today, unit).safeParse(fields);
  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message ?? weightMessage(unit),
    };
  }
  return { ok: true, value: result.data };
}
