// Small rules of the set table (D44): which fields an exercise has, the rest choices of its
// dropdown, how many rows it can have, and the pain check-in's stop rule.
import { painTrafficLight } from "@/lib/coach/painTrafficLight";

export type ExerciseKind = "WEIGHT_REPS" | "REPS_ONLY";

// A set is stored as reps and an optional weight, so only these two kinds exist. Distance
// and duration sets (runs, carries, planks) need new columns and are deferred (D44).
export function exerciseKind(equipment: string | null): ExerciseKind {
  return equipment?.trim().toLowerCase() === "body only"
    ? "REPS_ONLY"
    : "WEIGHT_REPS";
}

// The server accepts set numbers 1 to 6 (setLogSchema); "Add set" stops there.
export const MAX_SETS_PER_EXERCISE = 6;

// Rows shown for an exercise: the plan's sets, or the sets already logged if more, and never
// more than the limit.
export function initialRowCount(planned: number, logged: number): number {
  return Math.min(Math.max(planned, logged, 1), MAX_SETS_PER_EXERCISE);
}

export const canAddSet = (rows: number): boolean =>
  rows < MAX_SETS_PER_EXERCISE;

// A set that is logged (saved or queued) cannot be removed from the table.
export const canRemoveSet = (rows: number, logged: number): boolean =>
  rows > logged && rows > 1;

// Rest timer choices in seconds; 0 is Off. The plan's own rest is added when it is not one.
export const REST_CHOICES = [0, 30, 45, 60, 90, 120, 180, 300] as const;

export function restChoicesWith(planSeconds: number): number[] {
  const all = new Set<number>([...REST_CHOICES, planSeconds]);
  return [...all].sort((a, b) => a - b);
}

const SECONDS_PER_MINUTE = 60;

export function formatRestChoice(seconds: number): string {
  if (seconds === 0) return "Off";
  if (seconds < SECONDS_PER_MINUTE) return `${seconds}s`;
  const minutes = Math.floor(seconds / SECONDS_PER_MINUTE);
  const rest = seconds % SECONDS_PER_MINUTE;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

// The "How do you feel today?" check-in (D44): a 0 to 10 score, or null when skipped or
// not a whole number in range. It is stored with each set as "pain this morning before
// workout", so the saved stop rule of #92 reads it as it always did.
export function parseCheckIn(raw: string): number | null {
  if (!/^[0-9]{1,2}$/.test(raw.trim())) return null;
  const score = Number(raw);
  return score <= painTrafficLightMax ? score : null;
}

const painTrafficLightMax = 10;

export function checkInStops(score: number | null): boolean {
  return score !== null && painTrafficLight(0, score).state === "stop";
}
