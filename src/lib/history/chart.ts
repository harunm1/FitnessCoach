// The numbers behind the exercise history chart (live bug L6, 25 Nov 2026): a point per
// workout and an axis with round tick values. Pure, so the drawing component only places them.
import {
  estimatedOneRepMax,
  MAX_RELIABLE_REPS,
  MIN_LOAD_KG,
} from "@/lib/trainingProfile/workingWeights";
import { bestSet } from "./view";
import type { ExerciseHistory, HistorySet } from "./types";

export type ChartPoint = {
  workoutId: number;
  date: Date;
  topKg: number | null; // heaviest set; null for a bodyweight workout
  e1rmKg: number | null; // best Epley estimate; null when no set is a usable load
};

const isUsableLoad = (
  set: HistorySet,
): set is HistorySet & { weightKg: number } =>
  set.weightKg !== null &&
  set.weightKg >= MIN_LOAD_KG &&
  set.reps <= MAX_RELIABLE_REPS;

// Oldest first, which is the order a line is read in. Epley is reliable to about 10 reps
// (see trainingProfile/workingWeights), so longer sets are left out of the estimate.
export function chartPoints(
  workouts: ExerciseHistory["workouts"],
): ChartPoint[] {
  return [...workouts].reverse().map((workout) => {
    const estimates = workout.sets
      .filter(isUsableLoad)
      .map((set) => estimatedOneRepMax(set.weightKg, set.reps));
    return {
      workoutId: workout.workoutId,
      date: workout.startedAt,
      topKg: bestSet(workout.sets)?.weightKg ?? null,
      e1rmKg: estimates.length > 0 ? Math.max(...estimates) : null,
    };
  });
}

const TARGET_INTERVALS = 4;
const STEP_FACTORS = [1, 2, 2.5, 5, 10];

// The smallest of 1, 2, 2.5, 5 x 10^n that is at least the raw step.
function niceStep(raw: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const factor = STEP_FACTORS.find((f) => f * magnitude >= raw) ?? 10;
  return factor * magnitude;
}

export type NiceScale = {
  ticks: number[]; // ascending, evenly spaced
  toY: (value: number, height: number) => number; // lowest tick at `height`, highest at 0
};

// An axis from round tick values that contain every value. A flat series gets a range of its
// own around the value, so the line sits in the middle instead of on an edge.
export function niceScale(values: number[]): NiceScale {
  const low = Math.min(...values);
  const high = Math.max(...values);
  const span = high === low ? Math.max(Math.abs(high) * 0.2, 1) : high - low;
  const step = niceStep(span / TARGET_INTERVALS);
  const first = Math.floor((high === low ? low - span / 2 : low) / step) * step;
  const last = Math.ceil((high === low ? high + span / 2 : high) / step) * step;
  const ticks: number[] = [];
  for (let tick = first; tick <= last + step / 2; tick += step) {
    ticks.push(Math.round(tick * 1000) / 1000);
  }
  const bottom = ticks[0];
  const top = ticks[ticks.length - 1];
  return {
    ticks,
    toY: (value, height) =>
      height - ((value - bottom) / (top - bottom)) * height,
  };
}

const MAX_DATE_LABELS = 5;

// Which of `count` points get a date under the axis: the first, the last and an even few
// between, so the labels never touch.
export function tickDates(count: number): number[] {
  if (count <= 1) return [0];
  const labels = Math.min(count, MAX_DATE_LABELS);
  const picked = Array.from({ length: labels }, (_, i) =>
    Math.round((i * (count - 1)) / (labels - 1)),
  );
  return [...new Set(picked)];
}
