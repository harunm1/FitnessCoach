// getBodyWeightTrend (D43): the user's own weigh-ins from Progress over the last 90 days, as
// the coach reads them. Reviewing this logged trend is in scope; diet and calorie advice are not.
import type { PrismaClient } from "@/generated/prisma/client";
import { dayKey } from "@/lib/progress/dates";
import { fromKgBody, weightLabel, type WeightUnit } from "@/lib/units/convert";
import { calendarDayLabel, daysBefore, daysBetween, lastDays } from "./period";
import type { ToolResult } from "./types";

export const WEIGHT_TREND_DAYS = 90;
const DAYS_PER_WEEK = 7;
const HUNDREDTHS = 100;

export type WeighIn = { date: string; weightKg: number }; // date: "2026-11-24"

const round2 = (value: number) => Math.round(value * HUNDREDTHS) / HUNDREDTHS;

function trendLines(entries: WeighIn[], unit: WeightUnit): string[] {
  const label = weightLabel(unit);
  const shown = (entry: WeighIn) =>
    `${calendarDayLabel(entry.date)}, ${fromKgBody(entry.weightKg, unit)} ${label}`;
  const latest = entries.at(-1);
  if (latest === undefined) {
    return [
      "No body-weight entries in this period. The user logs them on Progress, Weight.",
    ];
  }
  if (entries.length === 1) {
    return [
      `Weigh-ins: 1. Latest: ${shown(latest)}.`,
      "One weigh-in is not a trend yet.",
    ];
  }
  const first = entries[0];
  const change = round2(
    fromKgBody(latest.weightKg, unit) - fromKgBody(first.weightKg, unit),
  );
  const days = daysBetween(first.date, latest.date);
  const perWeek = days === 0 ? 0 : round2((change / days) * DAYS_PER_WEEK);
  return [
    `Weigh-ins: ${entries.length}.`,
    `First: ${shown(first)}. Latest: ${shown(latest)}.`,
    `Change: ${change} ${label} over ${days} days, ${perWeek} ${label} a week.`,
  ];
}

// Entries oldest first.
export function bodyWeightTrendResult(
  entries: WeighIn[],
  unit: WeightUnit,
  now: Date,
): ToolResult {
  return {
    name: "getBodyWeightTrend",
    period: lastDays(WEIGHT_TREND_DAYS, now),
    lines: trendLines(entries, unit),
  };
}

export type WeightDb = Pick<PrismaClient, "bodyWeight">;

// Only this user's rows; the user id comes from the session, never from the message.
export async function getBodyWeightTrend(
  db: WeightDb,
  userId: string,
  unit: WeightUnit,
  now: Date,
): Promise<ToolResult> {
  const since = dayKey(daysBefore(WEIGHT_TREND_DAYS, now));
  const rows = await db.bodyWeight.findMany({
    where: { userId, date: { gte: new Date(`${since}T00:00:00Z`) } },
    orderBy: { date: "asc" },
    select: { date: true, weightKg: true },
  });
  return bodyWeightTrendResult(
    rows.map((row) => ({
      // A date column comes back as midnight UTC, so the first ten characters are the day.
      date: row.date.toISOString().slice(0, "YYYY-MM-DD".length),
      weightKg: Number(row.weightKg.toString()),
    })),
    unit,
    now,
  );
}
