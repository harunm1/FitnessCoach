// When and how often the user trains (D34), from workout start times.
import { DEFAULT_TIME_ZONE, dayKey, weekKey } from "@/lib/progress/dates";
import { RECENT_WEEKS, weeksAgo } from "./windows";

// A usual hour from fewer workouts than this would be a guess.
export const MIN_WORKOUTS_FOR_USUAL_HOUR = 3;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MONTHS_PER_YEAR = 12;
const TENTHS = 10;

const inWindow = (starts: Date[], since: Date, now: Date) =>
  starts.filter((start) => start >= since && start <= now);

// Workouts a week over the last 8 weeks, to one decimal.
export function workoutsPerWeek(starts: Date[], now: Date): number {
  const recent = inWindow(starts, weeksAgo(RECENT_WEEKS, now), now);
  return Math.round((recent.length / RECENT_WEEKS) * TENTHS) / TENTHS;
}

function minutesOfDay(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(date);
  const part = (type: string) =>
    Number(parts.find((item) => item.type === type)?.value ?? 0);
  return part("hour") * MINUTES_PER_HOUR + part("minute");
}

// The median start time of the last 8 weeks, rounded to the hour, in the given zone; null
// with fewer than three workouts.
export function usualHour(
  starts: Date[],
  now: Date,
  timeZone = DEFAULT_TIME_ZONE,
): number | null {
  const recent = inWindow(starts, weeksAgo(RECENT_WEEKS, now), now);
  if (recent.length < MIN_WORKOUTS_FOR_USUAL_HOUR) return null;
  const minutes = recent
    .map((start) => minutesOfDay(start, timeZone))
    .sort((a, b) => a - b);
  const middle = Math.floor(minutes.length / 2);
  const median =
    minutes.length % 2 === 1
      ? minutes[middle]
      : (minutes[middle - 1] + minutes[middle]) / 2;
  return Math.round(median / MINUTES_PER_HOUR) % HOURS_PER_DAY;
}

// How many of the last `weeks` weeks have at least one workout (Monday to Sunday weeks).
export function activeWeeks(
  starts: Date[],
  now: Date,
  weeks: number,
  timeZone = DEFAULT_TIME_ZONE,
): number {
  const recent = inWindow(starts, weeksAgo(weeks, now), now);
  return new Set(recent.map((start) => weekKey(dayKey(start, timeZone)))).size;
}

// Whole months from the first workout to now; 0 when the first workout is not yet past.
export function monthsBetween(first: Date, now: Date): number {
  const months =
    (now.getUTCFullYear() - first.getUTCFullYear()) * MONTHS_PER_YEAR +
    (now.getUTCMonth() - first.getUTCMonth());
  const wholeMonths =
    now.getUTCDate() < first.getUTCDate() ? months - 1 : months;
  return Math.max(0, wholeMonths);
}
