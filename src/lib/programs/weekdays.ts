// Weekday names for a plan day (D38), shared by the session page and the folders.
import type { Weekday } from "./templateSchema";

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MON: "Monday",
  TUE: "Tuesday",
  WED: "Wednesday",
  THU: "Thursday",
  FRI: "Friday",
  SAT: "Saturday",
  SUN: "Sunday",
};

export const weekdayLabel = (weekdays: readonly Weekday[]): string =>
  weekdays.map((w) => WEEKDAY_LABEL[w]).join(", ");
