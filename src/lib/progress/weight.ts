import { z } from "zod";

// Bounds shared with the CHECKs in 20261124190000_add_body_weight (D24) and
// with the progress photo form, so a weight valid in one place is valid in all.
export const MIN_WEIGHT_KG = 20;
export const MAX_WEIGHT_KG = 400;
export const MAX_NOTE_LENGTH = 300;
export const EARLIEST_DAY = "2000-01-01";

const WEIGHT_MESSAGE = `Enter a weight between ${MIN_WEIGHT_KG} and ${MAX_WEIGHT_KG} kg.`;
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
function isCalendarDay(text: string): boolean {
  // Four, two and two digits joined by hyphens: "2026-11-24" passes the shape,
  // "24/11/2026" and "2026-1-5" do not; the date check below rejects "2026-02-30".
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const date = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(text);
}

// Some keyboards type "81,5"; the database keeps two decimals.
const weightSchema = z
  .string({ error: WEIGHT_MESSAGE })
  .trim()
  .transform((text) =>
    text === "" ? Number.NaN : Number(text.replace(",", ".")),
  )
  .pipe(
    z
      .number({ error: WEIGHT_MESSAGE })
      .min(MIN_WEIGHT_KG, WEIGHT_MESSAGE)
      .max(MAX_WEIGHT_KG, WEIGHT_MESSAGE),
  )
  .transform((kg) => Math.round(kg * STEPS_PER_KG) / STEPS_PER_KG);

const noteSchema = z
  .string()
  .optional()
  .transform((text) => text?.trim() || null)
  .refine(
    // Array.from counts characters, as Postgres char_length does, not UTF-16 units.
    (text) => text === null || Array.from(text).length <= MAX_NOTE_LENGTH,
    `Keep the note to ${MAX_NOTE_LENGTH} characters.`,
  );

function entrySchema(today: string) {
  return z.object({
    date: z
      .string({ error: DATE_MESSAGE })
      .refine(isCalendarDay, DATE_MESSAGE)
      // YYYY-MM-DD strings sort the same way as the days they name.
      .refine((day) => day >= EARLIEST_DAY, "Choose a day from 2000 on.")
      .refine((day) => day <= today, "That day hasn't happened yet."),
    weightKg: weightSchema,
    note: noteSchema,
  });
}

// Checks one weigh-in from the form. `today` is the user's current day
// ("2026-11-24"), so a later day is refused.
export function parseWeightEntry(
  fields: { date: unknown; weightKg: unknown; note: unknown },
  today: string,
): WeightParse {
  const result = entrySchema(today).safeParse(fields);
  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message ?? WEIGHT_MESSAGE,
    };
  }
  return { ok: true, value: result.data };
}
