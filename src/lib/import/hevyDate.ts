// Reads the start and end times in a Hevy workout CSV (#131). The file carries no time
// zone, so times are read as local time in the app's zone. Only formats with an English
// month name or an ISO layout are accepted; an all-numeric day-first or month-first
// date is refused rather than guessed (docs/IMPORT_FORMATS.md).
import { DEFAULT_TIME_ZONE } from "@/lib/progress/dates";

const MONTHS = [
  "jan",
  "feb",
  "mar",
  "apr",
  "may",
  "jun",
  "jul",
  "aug",
  "sep",
  "oct",
  "nov",
  "dec",
];

// Accepts "20 Jun 2024, 18:30"; rejects "03/04/2024 10:00".
const DAY_FIRST = /^(\d{1,2}) ([a-z]{3}) (\d{4}), ?(\d{1,2}):(\d{2})$/i;
// Accepts "Nov 20, 2024, 6:30 PM"; rejects "Nov 20, 2024, 6:30" (no AM or PM).
const MONTH_FIRST =
  /^([a-z]{3}) (\d{1,2}), (\d{4}), ?(\d{1,2}):(\d{2}) (AM|PM)$/i;
// Accepts "2024-01-15 07:30:00" and "2024-01-15T07:30"; rejects "15-01-2024 07:30".
const ISO_LIKE = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/;

const HOURS_PER_HALF_DAY = 12;
const MAX_HOUR = 23;
const MAX_MINUTE = 59;

type Parts = {
  year: number;
  month: number; // 1 to 12
  day: number;
  hour: number;
  minute: number;
  second: number;
};

// Milliseconds the zone is ahead of UTC at that instant.
function zoneOffsetMs(instant: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(instant));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  const asUtc = Date.UTC(
    get("year"),
    get("month") - 1,
    get("day"),
    get("hour"),
    get("minute"),
    get("second"),
  );
  return asUtc - Math.floor(instant / 1000) * 1000;
}

// The UTC instant at which the zone's wall clock shows these parts, or null when the
// parts are not a real date and time (31 Feb, 25:00).
function toUtc(parts: Parts, timeZone: string): Date | null {
  const { year, month, day, hour, minute, second } = parts;
  const wall = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const real =
    wall.getUTCFullYear() === year &&
    wall.getUTCMonth() === month - 1 &&
    wall.getUTCDate() === day &&
    hour <= MAX_HOUR &&
    minute <= MAX_MINUTE;
  if (!real) return null;
  const guess = wall.getTime();
  const first = guess - zoneOffsetMs(guess, timeZone);
  const second2 = guess - zoneOffsetMs(first, timeZone);
  return new Date(second2);
}

export function parseHevyDate(
  text: string,
  timeZone = DEFAULT_TIME_ZONE,
): Date | null {
  const value = text.trim().replace(/\s+/g, " ");

  const dayFirst = DAY_FIRST.exec(value);
  if (dayFirst) {
    const month = MONTHS.indexOf(dayFirst[2].toLowerCase()) + 1;
    if (month === 0) return null;
    return toUtc(
      {
        year: Number(dayFirst[3]),
        month,
        day: Number(dayFirst[1]),
        hour: Number(dayFirst[4]),
        minute: Number(dayFirst[5]),
        second: 0,
      },
      timeZone,
    );
  }

  const monthFirst = MONTH_FIRST.exec(value);
  if (monthFirst) {
    const month = MONTHS.indexOf(monthFirst[1].toLowerCase()) + 1;
    const clock = Number(monthFirst[4]);
    if (month === 0 || clock < 1 || clock > HOURS_PER_HALF_DAY) return null;
    const pm = monthFirst[6].toUpperCase() === "PM";
    const hour = (clock % HOURS_PER_HALF_DAY) + (pm ? HOURS_PER_HALF_DAY : 0);
    return toUtc(
      {
        year: Number(monthFirst[3]),
        month,
        day: Number(monthFirst[2]),
        hour,
        minute: Number(monthFirst[5]),
        second: 0,
      },
      timeZone,
    );
  }

  const iso = ISO_LIKE.exec(value);
  if (iso) {
    return toUtc(
      {
        year: Number(iso[1]),
        month: Number(iso[2]),
        day: Number(iso[3]),
        hour: Number(iso[4]),
        minute: Number(iso[5]),
        second: Number(iso[6] ?? 0),
      },
      timeZone,
    );
  }
  return null;
}
