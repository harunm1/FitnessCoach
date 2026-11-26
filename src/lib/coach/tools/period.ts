// Dates and periods as the coach tools write them (D43): "24 Nov 2026", and a period named
// with its first and last day, both in the app's time zone.
import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";

const DAY_MS = 86_400_000;
const DAYS_PER_WEEK = 7;
const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// Day, month and year of an instant in a time zone, as numbers (ICU's short month names vary:
// en-GB writes "Sept"), so the label is built here.
function parts(date: Date, timeZone: string) {
  const values = new Intl.DateTimeFormat("en-US", {
    day: "numeric",
    month: "numeric",
    year: "numeric",
    timeZone,
  })
    .formatToParts(date)
    .reduce<Record<string, number>>((found, part) => {
      if (part.type !== "literal") found[part.type] = Number(part.value);
      return found;
    }, {});
  return { day: values.day, month: values.month, year: values.year };
}

function label(date: Date, timeZone: string): string {
  const { day, month, year } = parts(date, timeZone);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export const dayLabel = (date: Date) => label(date, DEFAULT_TIME_ZONE);

// "2026-11-24" as "24 Nov 2026". A body-weight row is a calendar day stored as midnight UTC.
export const calendarDayLabel = (day: string) =>
  label(new Date(`${day}T00:00:00Z`), "UTC");

export const daysBefore = (days: number, now: Date) =>
  new Date(now.getTime() - days * DAY_MS);

// "last 28 days (29 Oct 2026 to 26 Nov 2026)".
export function lastDays(days: number, now: Date): string {
  return `last ${days} days (${dayLabel(daysBefore(days, now))} to ${dayLabel(now)})`;
}

// "last 8 weeks (1 Oct 2026 to 26 Nov 2026)".
export function lastWeeks(weeks: number, now: Date): string {
  const from = daysBefore(weeks * DAYS_PER_WEEK, now);
  return `last ${weeks} weeks (${dayLabel(from)} to ${dayLabel(now)})`;
}

// Whole days between two calendar days ("2026-09-01" to "2026-11-24" is 84).
export function daysBetween(first: string, last: string): number {
  return Math.round(
    (Date.parse(`${last}T00:00:00Z`) - Date.parse(`${first}T00:00:00Z`)) /
      DAY_MS,
  );
}
