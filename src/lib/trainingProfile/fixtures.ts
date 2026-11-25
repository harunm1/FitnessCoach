// Synthetic training history for the profile tests (D34). Invented data only: never an export
// from a real account.
import type { HistorySet } from "./types";

const HOURS_PER_DAY = 24;
const MS_PER_HOUR = 3_600_000;
const DAY_MS = HOURS_PER_DAY * MS_PER_HOUR;
const DAYS_PER_WEEK = 7;
const SET_DAYS_AGO = 7;
const SET_REPS = 5;
const SET_KG = 80;

// A Wednesday at midday in Toronto.
export const NOW = new Date("2026-11-25T17:00:00Z");

export const daysAgo = (days: number, now = NOW) =>
  new Date(now.getTime() - days * DAY_MS);

// Workout start times, oldest first, on the given weekdays (0 is Sunday) at an hour in UTC,
// going back `weeks` weeks from `now`. A start after `now` is left out.
export function weeklyStarts(
  weeks: number,
  weekdays: number[],
  hourUtc: number,
  now = NOW,
): Date[] {
  const midnight = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Array.from({ length: weeks * DAYS_PER_WEEK + 1 }, (_, index) => {
    const back = weeks * DAYS_PER_WEEK - index;
    return new Date(midnight - back * DAY_MS);
  })
    .filter((day) => weekdays.includes(day.getUTCDay()))
    .map((day) => new Date(day.getTime() + hourUtc * MS_PER_HOUR))
    .filter((start) => start <= now);
}

export function historySet(overrides: Partial<HistorySet> = {}): HistorySet {
  return {
    exerciseId: "bench",
    exerciseName: "Bench Press",
    equipment: "barbell",
    reps: SET_REPS,
    weightKg: SET_KG,
    startedAt: daysAgo(SET_DAYS_AGO),
    ...overrides,
  };
}
