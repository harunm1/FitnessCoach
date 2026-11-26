// getRecentWorkouts (D43): the user's finished workouts over the last 28 days, with imported
// ones flagged, and every workout imported from Hevy counted with its first and last date.
import type { PrismaClient } from "@/generated/prisma/client";
import { IMPORT_SOURCE } from "@/lib/import/save";
import { KG_PER_LB, weightLabel, type WeightUnit } from "@/lib/units/convert";
import { dayLabel, daysBefore, lastDays } from "./period";
import type { ToolResult } from "./types";

export const RECENT_DAYS = 28;
const DAYS_PER_WEEK = 7;
const TOP_EXERCISES = 5;
const TENTHS = 10;

export type RecentSet = {
  exerciseName: string;
  reps: number;
  weightKg: number | null;
};
export type RecentWorkout = { source: string; sets: RecentSet[] };
export type ImportSpan = {
  count: number;
  first: Date | null;
  last: Date | null;
};

const volumeIn = (kg: number, unit: WeightUnit) =>
  Math.round(unit === "LB" ? kg / KG_PER_LB : kg);

function countLine(workouts: RecentWorkout[]): string {
  const imported = workouts.filter((w) => w.source === IMPORT_SOURCE).length;
  const perWeek =
    Math.round((workouts.length / (RECENT_DAYS / DAYS_PER_WEEK)) * TENTHS) /
    TENTHS;
  return `Finished workouts: ${workouts.length} (${imported} imported from Hevy, ${workouts.length - imported} logged in the app), ${perWeek} a week.`;
}

function setLines(sets: RecentSet[], unit: WeightUnit): string[] {
  if (sets.length === 0) return [];
  const volumeKg = sets.reduce(
    (sum, s) => sum + (s.weightKg === null ? 0 : s.weightKg * s.reps),
    0,
  );
  const perExercise = sets.reduce(
    (counts, s) =>
      counts.set(s.exerciseName, (counts.get(s.exerciseName) ?? 0) + 1),
    new Map<string, number>(),
  );
  const top = [...perExercise]
    .sort(([a, x], [b, y]) => y - x || a.localeCompare(b))
    .slice(0, TOP_EXERCISES)
    .map(([name, count]) => `${name} ${count}`);
  return [
    `Sets: ${sets.length}. Volume: ${volumeIn(volumeKg, unit)} ${weightLabel(unit)} (weight x reps, weighted sets only).`,
    `Most sets: ${top.join(", ")}.`,
  ];
}

function importLine({ count, first, last }: ImportSpan): string {
  if (count === 0 || first === null || last === null) {
    return "No workouts imported from Hevy.";
  }
  return `Imported from Hevy, all time: ${count} ${count === 1 ? "workout" : "workouts"}, ${dayLabel(first)} to ${dayLabel(last)}.`;
}

export function recentWorkoutsResult(
  workouts: RecentWorkout[],
  imports: ImportSpan,
  unit: WeightUnit,
  now: Date,
): ToolResult {
  const lines =
    workouts.length === 0
      ? ["No finished workouts in this period."]
      : [
          countLine(workouts),
          ...setLines(
            workouts.flatMap((w) => w.sets),
            unit,
          ),
        ];
  return {
    name: "getRecentWorkouts",
    period: lastDays(RECENT_DAYS, now),
    lines: [...lines, importLine(imports)],
  };
}

export type WorkoutDb = Pick<PrismaClient, "workout">;

// Only this user's rows; the user id comes from the session, never from the message. The
// window is bounded (28 days), and the all-time import figure is one aggregate, not rows.
export async function getRecentWorkouts(
  db: WorkoutDb,
  userId: string,
  unit: WeightUnit,
  now: Date,
): Promise<ToolResult> {
  const finished = { userId, finishedAt: { not: null } };
  const [rows, imports] = await Promise.all([
    db.workout.findMany({
      where: {
        ...finished,
        startedAt: { gte: daysBefore(RECENT_DAYS, now), lte: now },
      },
      orderBy: { startedAt: "asc" },
      select: {
        source: true,
        sets: {
          select: {
            reps: true,
            weightKg: true,
            exercise: { select: { name: true } },
          },
        },
      },
    }),
    db.workout.aggregate({
      where: { ...finished, source: IMPORT_SOURCE },
      _count: { _all: true },
      _min: { startedAt: true },
      _max: { startedAt: true },
    }),
  ]);
  const workouts = rows.map((row) => ({
    source: row.source,
    sets: row.sets.map((s) => ({
      exerciseName: s.exercise.name,
      reps: s.reps,
      weightKg: s.weightKg === null ? null : Number(s.weightKg.toString()),
    })),
  }));
  return recentWorkoutsResult(
    workouts,
    {
      count: imports._count._all,
      first: imports._min.startedAt,
      last: imports._max.startedAt,
    },
    unit,
    now,
  );
}
