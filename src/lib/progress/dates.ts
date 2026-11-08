// Calendar days and weeks for the progress page (#16), in the user's time zone.
// Workouts are stored in UTC, so a workout at 11 p.m. in Toronto is already the next
// day in UTC. Days are computed in America/Toronto until profiles store a time zone.
export const DEFAULT_TIME_ZONE = "America/Toronto";

// "2026-11-08" for the day the timestamp falls on in the given zone.
// The en-CA locale formats dates as YYYY-MM-DD.
export function dayKey(date: Date, timeZone = DEFAULT_TIME_ZONE): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

// A day key as a UTC midnight Date, so day arithmetic ignores daylight saving.
function fromDayKey(day: string): Date {
  const [year, month, date] = day.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, date));
}

function toDayKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

// The Monday of the week containing the day, as a day key. Weeks run Monday to Sunday.
export function weekKey(day: string): string {
  const date = fromDayKey(day);
  const daysSinceMonday = (date.getUTCDay() + 6) % 7; // Sunday 0 -> 6, Monday 1 -> 0
  date.setUTCDate(date.getUTCDate() - daysSinceMonday);
  return toDayKey(date);
}

// The Monday seven days earlier.
export function previousWeek(week: string): string {
  const date = fromDayKey(week);
  date.setUTCDate(date.getUTCDate() - 7);
  return toDayKey(date);
}
