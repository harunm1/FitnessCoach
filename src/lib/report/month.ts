import { dayKey } from "@/lib/progress/dates";

// Months are "2026-11" keys and mean the Toronto calendar month, like every day in the app.
const MONTH_LENGTH = 7;
const ONE_DAY_MS = 86_400_000;
const MIDDLE_OF_MONTH = 15;

export const monthOf = (date: Date): string =>
  dayKey(date).slice(0, MONTH_LENGTH);

export const inMonth = (date: Date, month: string): boolean =>
  monthOf(date) === month;

function utcStartOf(month: string): number {
  const [year, number] = month.split("-").map(Number);
  return Date.UTC(year, number - 1, 1);
}

// A database range that holds every Toronto moment of the month: the UTC month padded by a
// day on each side (Toronto is 4 to 5 hours behind UTC). Rows are then kept with `inMonth`.
export function monthSearchWindow(month: string): { from: Date; to: Date } {
  const start = utcStartOf(month);
  const [year, number] = month.split("-").map(Number);
  const next = Date.UTC(year, number, 1);
  return {
    from: new Date(start - ONE_DAY_MS),
    to: new Date(next + ONE_DAY_MS),
  };
}

// "November 2026".
export function monthLabel(month: string): string {
  const [year, number] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(year, number - 1, MIDDLE_OF_MONTH)));
}
