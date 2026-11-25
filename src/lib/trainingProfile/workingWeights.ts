// What the user can lift now (D34): per exercise, the set of the last 8 weeks with the highest
// estimated one-rep max. A weight the user actually lifted, never one worked out for a rep count.
import type { HistorySet, WorkingWeight } from "./types";
import { RECENT_WEEKS, weeksAgo } from "./windows";

// Epley's formula is reliable to about 10 reps (Reynolds, Gordon and Robergs 2006), so a longer
// set says little about a maximum.
export const MAX_RELIABLE_REPS = 10;
// Under a kilogram is a typo or a bodyweight mark, not a load.
export const MIN_LOAD_KG = 1;
const EPLEY_DIVISOR = 30;
const HUNDREDTHS = 100;

const toHundredths = (value: number) =>
  Math.round(value * HUNDREDTHS) / HUNDREDTHS;

// Epley (1985): weight x (1 + reps / 30); a single is its own weight.
export function estimatedOneRepMax(weightKg: number, reps: number): number {
  return reps === 1
    ? weightKg
    : toHundredths(weightKg * (1 + reps / EPLEY_DIVISOR));
}

type Candidate = WorkingWeight & { startedAt: Date };

const isUsable = (
  set: HistorySet,
  since: Date,
): set is HistorySet & {
  weightKg: number;
} =>
  set.weightKg !== null &&
  set.weightKg >= MIN_LOAD_KG &&
  set.reps >= 1 &&
  set.reps <= MAX_RELIABLE_REPS &&
  set.startedAt >= since;

const candidate = (set: HistorySet & { weightKg: number }): Candidate => ({
  exerciseId: set.exerciseId,
  exerciseName: set.exerciseName,
  weightKg: set.weightKg,
  reps: set.reps,
  e1rmKg: estimatedOneRepMax(set.weightKg, set.reps),
  startedAt: set.startedAt,
});

// Higher estimated 1RM wins; on a tie the newer set.
const better = (a: Candidate, b: Candidate) =>
  a.e1rmKg !== b.e1rmKg
    ? a.e1rmKg > b.e1rmKg
    : a.startedAt.getTime() > b.startedAt.getTime();

export function workingWeights(sets: HistorySet[], now: Date): WorkingWeight[] {
  const since = weeksAgo(RECENT_WEEKS, now);
  const best = sets
    .filter((set) => isUsable(set, since))
    .map(candidate)
    .reduce((byExercise, next) => {
      const current = byExercise.get(next.exerciseId);
      return byExercise.set(
        next.exerciseId,
        current && !better(next, current) ? current : next,
      );
    }, new Map<string, Candidate>());
  return [...best.values()]
    .sort(
      (a, b) =>
        b.e1rmKg - a.e1rmKg || a.exerciseName.localeCompare(b.exerciseName),
    )
    .map(({ exerciseId, exerciseName, weightKg, reps, e1rmKg }) => ({
      exerciseId,
      exerciseName,
      weightKg,
      reps,
      e1rmKg,
    }));
}
