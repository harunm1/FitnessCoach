import { formatWeight, type WeightUnit } from "@/lib/units/convert";
// Pure helpers for the history pages (D29): names, lengths, set labels, the best set
// and the points of the top-weight line. No database, no React.

import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";

const MINUTE_MS = 60_000;
const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});
export const LINE_BOX = { width: 240, height: 60 };

type SetValues = { reps: number; weightKg: number | null; rpe: number | null };

export function workoutName(workout: {
  planDayName: string | null;
  imported: boolean;
  notes: string | null; // an imported workout's title (#131)
  isRun: boolean;
}): string {
  if (workout.planDayName) return workout.planDayName;
  if (workout.imported && workout.notes) return workout.notes;
  return workout.isRun ? "Run" : "Workout";
}

// Items grouped by key, groups in the order their first item came, items kept in order.
export function groupInOrder<T, K>(
  items: T[],
  key: (item: T) => K,
): Map<K, T[]> {
  return items.reduce((groups, item) => {
    const k = key(item);
    groups.set(k, [...(groups.get(k) ?? []), item]);
    return groups;
  }, new Map<K, T[]>());
}

// "Sunday, November 8, 2026", on the app's calendar (Toronto), like the Progress page.
export function dateLabel(date: Date): string {
  return DATE_FORMAT.format(date);
}

export function minutesBetween(startedAt: Date, finishedAt: Date): number {
  return Math.max(
    1,
    Math.round((finishedAt.getTime() - startedAt.getTime()) / MINUTE_MS),
  );
}

export function setLabel(set: SetValues, unit: WeightUnit = "KG"): string {
  const weight =
    set.weightKg === null ? "" : ` × ${formatWeight(set.weightKg, unit)}`;
  const effort = set.rpe === null ? "" : ` · RPE ${set.rpe}`;
  const reps = set.reps === 1 ? "rep" : "reps";
  return `${set.reps} ${reps}${weight}${effort}`;
}

// The heaviest set, then the most reps at that weight; a weighted set beats any
// bodyweight set. Null for no sets.
export function bestSet<T extends SetValues>(sets: T[]): T | null {
  return sets.reduce<T | null>((best, set) => {
    if (!best) return set;
    const weight = set.weightKg ?? -1;
    const bestWeight = best.weightKg ?? -1;
    if (weight !== bestWeight) return weight > bestWeight ? set : best;
    return set.reps > best.reps ? set : best;
  }, null);
}

// SVG polyline points for the top weight of each workout, oldest first. Workouts
// without a weight are skipped; fewer than two weighted workouts draw no line.
export function topWeightLine(
  topWeights: (number | null)[],
  box: { width: number; height: number } = LINE_BOX,
): { points: string; min: number; max: number; count: number } | null {
  const weights = topWeights.filter((value): value is number => value !== null);
  if (weights.length < 2) return null;
  const min = Math.min(...weights);
  const max = Math.max(...weights);
  const step = box.width / (weights.length - 1);
  const y = (value: number) =>
    max === min
      ? box.height / 2
      : box.height - ((value - min) / (max - min)) * box.height;
  const points = weights
    .map((value, i) => `${round(i * step)},${round(y(value))}`)
    .join(" ");
  return { points, min, max, count: weights.length };
}

function round(value: number) {
  return Math.round(value * 10) / 10;
}
