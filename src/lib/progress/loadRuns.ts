import "server-only";
import { prisma } from "@/lib/prisma";
import { dayKey } from "./dates";
import { MANUAL_RUN_SOURCE } from "./runLimits";
import { duration } from "./view";

export const RECENT_RUNS = 5;

// One run in the Progress page's list (D27): plain values, ready to show.
export type RecentRun = {
  id: number;
  day: string; // the Toronto day, "2026-11-23"
  distanceKm: number;
  time: string; // "31:12"
  durationSec: number; // the pace is worked out at display, per km or per mile
  effort: number | null; // 1 to 10, from RunLog
  note: string | null;
  planDayName: string | null; // the plan day the run completed
};

// This user's latest finished runs, newest first: runs logged here by hand and
// runs saved with a session (both set the workout's distance and time).
export async function loadRecentRuns(userId: string): Promise<RecentRun[]> {
  const rows = await prisma.workout.findMany({
    where: {
      userId,
      finishedAt: { not: null },
      distanceKm: { not: null },
      durationSeconds: { not: null },
    },
    orderBy: [{ startedAt: "desc" }, { id: "desc" }],
    take: RECENT_RUNS,
    select: {
      id: true,
      startedAt: true,
      distanceKm: true,
      durationSeconds: true,
      notes: true,
      source: true,
      planDay: { select: { name: true } },
      run: { select: { rpe: true } },
    },
  });
  return rows.map((row) => {
    const distanceKm = Number(row.distanceKm?.toString());
    const seconds = row.durationSeconds ?? 0;
    return {
      id: row.id,
      day: dayKey(row.startedAt),
      distanceKm,
      time: duration(seconds),
      durationSec: seconds,
      effort: row.run?.rpe ?? null,
      // An imported workout's notes hold its title, not a note about the run.
      note: row.source === MANUAL_RUN_SOURCE ? row.notes : null,
      planDayName: row.planDay?.name ?? null,
    };
  });
}
