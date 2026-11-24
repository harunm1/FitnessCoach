// Formats a stored instant as local time (#141, #144). Times are stored in UTC and the
// server runs in UTC, so a time formatted on the server shows the wrong hour; this takes
// the zone as an argument, and the browser passes none to get its own.
const FORMATS = {
  datetime: { dateStyle: "full", timeStyle: "short" },
  time: { timeStyle: "short" },
} as const;

export type LocalTimeKind = keyof typeof FORMATS;

export function formatLocal(
  date: Date,
  kind: LocalTimeKind,
  timeZone?: string,
): string {
  return new Intl.DateTimeFormat("en-US", {
    ...FORMATS[kind],
    timeZone,
  }).format(date);
}
