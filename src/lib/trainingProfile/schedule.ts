// When and how often the user trains (D36), from workout start times.
import { DEFAULT_TIME_ZONE, dayKey, weekKey } from "@/lib/progress/dates";
import { DAYS_PER_WEEK, DAY_MS, RECENT_WEEKS, weeksAgo } from "./windows";

// A usual hour from fewer workouts than this would be a guess.
export const MIN_WORKOUTS_FOR_USUAL_HOUR = 3;
const MINUTES_PER_HOUR = 60;
const HOURS_PER_DAY = 24;
const MONTHS_PER_YEAR = 12;
const MINUTES_PER_DAY = HOURS_PER_DAY * MINUTES_PER_HOUR;
const DAY_CUT_MINUTES = 4 * MINUTES_PER_HOUR;
const TENTHS = 10;

const inWindow = (starts: Date[], since: Date, now: Date) =>
  starts.filter((start) => start >= since && start <= now);

// Workouts a week over the last 8 weeks, to one decimal. A user who started less than 8 weeks
// ago is measured over the weeks since the first workout (at least one), so a new user's
// rate is not understated.
export function workoutsPerWeek(starts: Date[], now: Date): number {
  const recent = inWindow(starts, weeksAgo(RECENT_WEEKS, now), now);
  const first = starts.reduce(
    (min, start) => Math.min(min, start.getTime()),
    now.getTime(),
  );
  const weeksTraining = Math.ceil(
    (now.getTime() - first) / (DAYS_PER_WEEK * DAY_MS),
  );
  const weeks = Math.min(RECENT_WEEKS, Math.max(1, weeksTraining));
  return Math.round((recent.length / weeks) * TENTHS) / TENTHS;
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
  // The day is cut at 04:00, not midnight, so a 23:30 and a 00:30 start sit side by side.
  const minutes = recent
    .map(
      (start) =>
        (minutesOfDay(start, timeZone) - DAY_CUT_MINUTES + MINUTES_PER_DAY) %
        MINUTES_PER_DAY,
    )
    .sort((a, b) => a - b);
  const middle = Math.floor(minutes.length / 2);
  const median =
    minutes.length % 2 === 1
      ? minutes[middle]
      : (minutes[middle - 1] + minutes[middle]) / 2;
  const shifted = (median + DAY_CUT_MINUTES) % MINUTES_PER_DAY;
  return Math.round(shifted / MINUTES_PER_HOUR) % HOURS_PER_DAY;
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
export function monthsBetween(
  first: Date,
  now: Date,
  timeZone = DEFAULT_TIME_ZONE,
): number {
  // Dates as the user lives them (Toronto), like the weeks and the usual hour.
  const [fy, fm, fd] = dayKey(first, timeZone).split("-").map(Number);
  const [ny, nm, nd] = dayKey(now, timeZone).split("-").map(Number);
  const months = (ny - fy) * MONTHS_PER_YEAR + (nm - fm);
  return Math.max(0, nd < fd ? months - 1 : months);
}
