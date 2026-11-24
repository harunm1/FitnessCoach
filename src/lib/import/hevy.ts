// Reads a Hevy workout CSV into workouts and sets (#131), all in code with no model call.
// Column names and rules are in docs/IMPORT_FORMATS.md. Any bad row refuses the whole
// file, so an import is never silently partial.
import { parseCsv } from "./csv";
import { parseHevyDate } from "./hevyDate";

export const MAX_IMPORT_BYTES = 2_000_000;
export const MAX_IMPORT_ROWS = 20_000;
const MAX_COLUMNS = 64; // a Hevy export has about 20; a wider header is not one

const MAX_REPS = 1000;
const MAX_TITLE_LENGTH = 200;
const MAX_WEIGHT_KG = 1000;
const MIN_RPE = 1;
const MAX_RPE = 10;
const KG_PER_LB = 0.45359237;
const CENTS = 100;
const ERRORS_SHOWN = 5;
const FIRST_DATA_ROW = 2; // row 1 is the header

export type ImportSet = {
  exerciseTitle: string;
  setNumber: number; // 1, 2, 3 per exercise within the workout
  reps: number;
  weightKg: number | null;
  rpe: number | null;
};

export type ImportWorkout = {
  key: string; // start time (ISO) and title: the dedupe key
  title: string;
  startedAt: Date;
  finishedAt: Date;
  sets: ImportSet[];
};

export type HevyParse =
  | {
      ok: true;
      workouts: ImportWorkout[];
      skippedWarmups: number;
      skippedRows: number;
    }
  | { ok: false; error: string };

const REQUIRED = ["title", "start_time", "exercise_title", "reps"];

const fail = (error: string): HevyParse => ({ ok: false, error });

function wholeNumber(text: string, max: number): number | null {
  // Accepts "8"; rejects "8.5", "-1" and "".
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value <= max ? value : null;
}

const roundCents = (kg: number) => Math.round(kg * CENTS) / CENTS;

function readWeight(kg: string, lbs: string): number | null | "bad" {
  const text = kg !== "" ? kg : lbs;
  if (text === "") return null;
  // Accepts "80" and "102.5"; rejects "0x10", "1e3" and "-5".
  if (!/^\d+(\.\d+)?$/.test(text)) return "bad";
  const value = Number(text);
  const inKg = kg !== "" ? value : value * KG_PER_LB;
  return inKg > MAX_WEIGHT_KG ? "bad" : roundCents(inKg);
}

function readRpe(text: string): number | null {
  const value = wholeNumber(text, MAX_RPE);
  return value !== null && value >= MIN_RPE ? value : null;
}

export function parseHevyCsv(text: string): HevyParse {
  let rows: string[][];
  try {
    rows = parseCsv(text);
  } catch (error) {
    return fail(error instanceof Error ? error.message : "Not a CSV file.");
  }
  if (rows.length < FIRST_DATA_ROW)
    return fail("The file has no workout rows.");
  if (rows.length - 1 > MAX_IMPORT_ROWS) {
    return fail(
      `The file has more than ${MAX_IMPORT_ROWS.toLocaleString("en-US")} rows. Export a shorter range.`,
    );
  }

  if (rows[0].length > MAX_COLUMNS) {
    return fail(
      `This file has more than ${MAX_COLUMNS} columns, so it is not a Hevy workout export.`,
    );
  }
  const header = rows[0].map((name) => name.trim().toLowerCase());
  // Each column's position is found once, not per cell, so a row costs the same
  // however many columns there are.
  const position = new Map<string, number>();
  header.forEach((name, i) => {
    if (!position.has(name)) position.set(name, i);
  });
  const column = (name: string) => position.get(name) ?? -1;
  const hasWeight = column("weight_kg") >= 0 || column("weight_lbs") >= 0;
  const missing = [
    ...REQUIRED.filter((name) => column(name) < 0),
    ...(hasWeight ? [] : ["weight_kg or weight_lbs"]),
  ];
  if (missing.length > 0) {
    return fail(
      `This does not look like a Hevy workout export. Missing columns: ${missing.join(", ")}.`,
    );
  }
  const cell = (row: string[], name: string) => {
    const i = column(name);
    return i < 0 ? "" : (row[i] ?? "").trim();
  };

  const workouts = new Map<string, ImportWorkout>();
  const perExercise = new Map<string, number>();
  const errors: string[] = [];
  let skippedWarmups = 0;
  let skippedRows = 0;

  rows.slice(1).forEach((row, offset) => {
    const rowNumber = offset + FIRST_DATA_ROW;
    const problem = (message: string) => {
      errors.push(`Row ${rowNumber}: ${message}`);
    };

    if (row.length < header.length) {
      problem("this row has fewer values than the header.");
      return;
    }
    if (cell(row, "set_type").toLowerCase() === "warmup") {
      skippedWarmups += 1;
      return;
    }
    if (cell(row, "reps") === "") {
      skippedRows += 1; // a timed set: no reps to store
      return;
    }
    const startedAt = parseHevyDate(cell(row, "start_time"));
    if (!startedAt) {
      problem(
        "the start time is not in a format we read. Upload the file exactly as Hevy exported it.",
      );
      return;
    }
    const endText = cell(row, "end_time");
    const finishedAt = endText === "" ? startedAt : parseHevyDate(endText);
    if (!finishedAt || finishedAt < startedAt) {
      problem("the end time is missing or before the start.");
      return;
    }
    const exerciseTitle = cell(row, "exercise_title");
    const reps = wholeNumber(cell(row, "reps"), MAX_REPS);
    const weightKg = readWeight(
      cell(row, "weight_kg"),
      cell(row, "weight_lbs"),
    );
    if (!exerciseTitle) return problem("the exercise name is empty.");
    if (
      exerciseTitle.length > MAX_TITLE_LENGTH ||
      cell(row, "title").length > MAX_TITLE_LENGTH
    )
      return problem(`a name is longer than ${MAX_TITLE_LENGTH} characters.`);
    if (reps === null || reps < 1)
      return problem("the reps are not a whole number from 1 to 1,000.");
    if (weightKg === "bad")
      return problem("the weight is not a number from 0 to 1,000 kg.");

    const title = cell(row, "title") || "Workout";
    const key = `${startedAt.toISOString()}|${title}`;
    const workout = workouts.get(key) ?? {
      key,
      title,
      startedAt,
      finishedAt,
      sets: [],
    };
    const counterKey = `${key}|${exerciseTitle}`;
    const setNumber = (perExercise.get(counterKey) ?? 0) + 1;
    perExercise.set(counterKey, setNumber);
    workout.sets.push({
      exerciseTitle,
      setNumber,
      reps,
      weightKg,
      rpe: readRpe(cell(row, "rpe")),
    });
    workouts.set(key, workout);
  });

  if (errors.length > 0) {
    const shown = errors.slice(0, ERRORS_SHOWN).join(" ");
    const more =
      errors.length > ERRORS_SHOWN
        ? ` And ${errors.length - ERRORS_SHOWN} more.`
        : "";
    return fail(`${shown}${more}`);
  }
  const list = [...workouts.values()].sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );
  if (list.length === 0) return fail("The file has no sets we can import.");
  return { ok: true, workouts: list, skippedWarmups, skippedRows };
}
