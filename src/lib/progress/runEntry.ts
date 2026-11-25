import { z } from "zod";

import {
  distanceBounds,
  distanceLabel,
  KM_PER_MI,
  type DistanceUnit,
} from "@/lib/units/convert";
import { clock } from "./view";
import { isCalendarDay } from "./weight";
import {
  EARLIEST_RUN_DAY,
  FASTEST_SEC_PER_KM,
  MAX_EFFORT,
  MAX_RUN_KM,
  MAX_RUN_NOTE_LENGTH,
  MAX_RUN_SECONDS,
  MIN_EFFORT,
  MIN_RUN_KM,
  SLOWEST_SEC_PER_KM,
} from "./runLimits";

// The limits are kilometres; the message names them in the unit the user typed in (D30).
function distanceMessage(unit: DistanceUnit) {
  const [min, max] = distanceBounds(MIN_RUN_KM, MAX_RUN_KM, unit);
  return `Enter a distance between ${min} and ${max} ${distanceLabel(unit)}.`;
}

// A pace bound in seconds per kilometre, as the clock time per kilometre or per mile.
function paceText(secPerKm: number, unit: DistanceUnit) {
  const seconds = unit === "MI" ? secPerKm * KM_PER_MI : secPerKm;
  return `${clock(seconds)} per ${distanceLabel(unit)}`;
}
const TIME_MESSAGE = "Enter the time as h:mm:ss, for example 0:32:15.";
const DATE_MESSAGE = "Choose the day you ran.";
const EFFORT_MESSAGE = `Effort is a whole number from ${MIN_EFFORT} to ${MAX_EFFORT}.`;

export type RunEntry = {
  date: string; // "2026-11-24"
  distanceKm: number;
  durationSec: number;
  effort: number | null;
  note: string | null;
};

export type RunParse =
  { ok: true; value: RunEntry } | { ok: false; message: string };

// The database keeps distances to 0.01 km (Decimal(5,2)).
const STEPS_PER_KM = 100;
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

// "h:mm:ss", hours up to two digits, minutes and seconds 00 to 59:
// "0:32:15" and "12:05:00" match; "0:61:00" and "1:2:3" do not.
const HMS = /^(\d{1,2}):([0-5]\d):([0-5]\d)$/;
// "mm:ss", minutes up to three digits, seconds 00 to 59:
// "32:15" and "125:00" match; "32" and "32:60" do not.
const MS = /^(\d{1,3}):([0-5]\d)$/;

// The run's time in seconds, or null when the text is not a clock time.
export function parseDuration(text: string): number | null {
  const trimmed = text.trim();
  const long = HMS.exec(trimmed);
  if (long) {
    const [, hours, minutes, seconds] = long.map(Number);
    return hours * SECONDS_PER_HOUR + minutes * SECONDS_PER_MINUTE + seconds;
  }
  const short = MS.exec(trimmed);
  if (short) {
    const [, minutes, seconds] = short.map(Number);
    return minutes * SECONDS_PER_MINUTE + seconds;
  }
  return null;
}

// Up to three digits, then optionally a "." or "," and more digits: "5.2" and
// "5,2" match; "1e2" and "0x10" do not, though Number() would read them.
const DISTANCE_TEXT = /^\d{1,3}([.,]\d+)?$/;

function distanceSchema(unit: DistanceUnit) {
  const message = distanceMessage(unit);
  return z
    .string({ error: message })
    .trim()
    .transform((text) =>
      DISTANCE_TEXT.test(text) ? Number(text.replace(",", ".")) : Number.NaN,
    )
    .pipe(
      z
        .number({ error: message })
        .min(MIN_RUN_KM, message)
        .max(MAX_RUN_KM, message),
    )
    .transform((km) => Math.round(km * STEPS_PER_KM) / STEPS_PER_KM);
}

const durationSchema = z
  .string({ error: TIME_MESSAGE })
  .transform((text) => parseDuration(text) ?? Number.NaN)
  .pipe(
    z
      .number({ error: TIME_MESSAGE })
      .min(1, "Enter a time longer than zero.")
      .max(MAX_RUN_SECONDS, "Keep the time to 24 hours or less."),
  );

// Blank means not given; otherwise a whole number in range.
const effortSchema = z
  .string()
  .optional()
  // Digits only, so "7" and "10" are read; "+7", "1e1" and "0x5" are refused.
  .transform((text) =>
    !text?.trim()
      ? null
      : /^\d+$/.test(text.trim())
        ? Number(text.trim())
        : Number.NaN,
  )
  .refine(
    (effort) =>
      effort === null ||
      (Number.isInteger(effort) &&
        effort >= MIN_EFFORT &&
        effort <= MAX_EFFORT),
    EFFORT_MESSAGE,
  );

const noteSchema = z
  .string()
  .optional()
  .transform((text) => text?.trim() || null)
  .refine(
    // Array.from counts characters, as Postgres char_length does, not UTF-16 units.
    (text) => text === null || Array.from(text).length <= MAX_RUN_NOTE_LENGTH,
    `Keep the note to ${MAX_RUN_NOTE_LENGTH} characters.`,
  );

function entrySchema(today: string, unit: DistanceUnit) {
  return z
    .object({
      date: z
        .string({ error: DATE_MESSAGE })
        .refine(isCalendarDay, DATE_MESSAGE)
        // YYYY-MM-DD strings sort the same way as the days they name.
        .refine((day) => day >= EARLIEST_RUN_DAY, "Choose a day from 2000 on.")
        .refine((day) => day <= today, "That day hasn't happened yet."),
      distanceKm: distanceSchema(unit),
      duration: durationSchema,
      effort: effortSchema,
      note: noteSchema,
    })
    .superRefine((run, context) => {
      const secPerKm = run.duration / run.distanceKm;
      if (secPerKm < FASTEST_SEC_PER_KM) {
        context.addIssue({
          code: "custom",
          path: ["duration"],
          message: `That pace is faster than ${paceText(FASTEST_SEC_PER_KM, unit)}. Check the distance and time.`,
        });
      } else if (secPerKm > SLOWEST_SEC_PER_KM) {
        context.addIssue({
          code: "custom",
          path: ["duration"],
          message: `That pace is slower than ${paceText(SLOWEST_SEC_PER_KM, unit)}. Check the distance and time.`,
        });
      }
    });
}

// Checks one run from the form. `today` is the user's current day
// ("2026-11-24"), so a later day is refused.
export function parseRunEntry(
  fields: {
    date: unknown;
    distanceKm: unknown;
    duration: unknown;
    effort: unknown;
    note: unknown;
  },
  today: string,
  unit: DistanceUnit = "KM",
): RunParse {
  const result = entrySchema(today, unit).safeParse(fields);
  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message ?? distanceMessage(unit),
    };
  }
  const { date, distanceKm, duration, effort, note } = result.data;
  return {
    ok: true,
    value: { date, distanceKm, durationSec: duration, effort, note },
  };
}
