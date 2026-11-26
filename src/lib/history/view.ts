import { formatWeight, type WeightUnit } from "@/lib/units/convert";
// Pure helpers for the history pages (D29): names, lengths, set labels, the best set
// and the best set. No database, no React.

import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";

const DATE_FORMAT = new Intl.DateTimeFormat("en", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: DEFAULT_TIME_ZONE,
});

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

// Total weight lifted: reps times weight over every weighted set. A bodyweight set has no
// weight to multiply, so it adds nothing (live bug L5, 25 Nov 2026).
export function totalVolumeKg(
  exercises: { sets: { reps: number; weightKg: number | null }[] }[],
): number {
  return exercises
    .flatMap((exercise) => exercise.sets)
    .reduce((sum, set) => sum + set.reps * (set.weightKg ?? 0), 0);
}

// The exercises whose top weight here beats the heaviest weight lifted before this workout.
// A first time (no earlier weight) and a bodyweight exercise are not records.
export function weightRecords(
  exercises: { id: string; sets: { weightKg: number | null }[] }[],
  earlierBestKg: Record<string, number>,
): string[] {
  return exercises
    .filter(({ id, sets }) => {
      const top = Math.max(0, ...sets.map((set) => set.weightKg ?? 0));
      const before = Object.hasOwn(earlierBestKg, id) ? earlierBestKg[id] : 0;
      return before > 0 && top > before;
    })
    .map(({ id }) => id);
}
