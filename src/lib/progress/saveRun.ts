import "server-only";
import { prisma } from "@/lib/prisma";
import { dayKey } from "./dates";
import { MANUAL_RUN_SOURCE } from "./runLimits";
import type { RunEntry } from "./runEntry";
import type { PlanForRun, RunPlanDay } from "./runPlanDay";

// No clock time is asked for, so a run is stored at 17:00 UTC on its day:
// noon in Toronto in winter, 1 p.m. in summer, the same day either way.
const STORED_HOUR_UTC = "T17:00:00Z";
const MS_PER_SECOND = 1000;

// The user's active plan with what planDayForRun needs, in one query: the
// days in rotation order, whether a session is open, and the finished count.
export async function loadPlanForRun(
  userId: string,
): Promise<(PlanForRun & { dayNames: Map<number, string> }) | null> {
  const plan = await prisma.plan.findFirst({
    where: { userId, active: true },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      createdAt: true,
      days: {
        orderBy: { dayIndex: "asc" },
        select: {
          id: true,
          kind: true,
          name: true,
          run: { select: { type: true } },
        },
      },
      workouts: {
        where: { userId, finishedAt: null },
        select: { id: true },
        take: 1,
      },
      _count: {
        select: { workouts: { where: { userId, finishedAt: { not: null } } } },
      },
    },
  });
  if (!plan) return null;
  return {
    id: plan.id,
    createdDay: dayKey(plan.createdAt),
    finishedWorkouts: plan._count.workouts,
    hasOpenWorkout: plan.workouts.length > 0,
    days: plan.days.map((day) => ({
      id: day.id,
      kind: day.kind,
      runType: day.run?.type ?? null,
    })),
    dayNames: new Map(plan.days.map((day) => [day.id, day.name])),
  };
}

// Saves the run as a finished workout and its RunLog in one nested create, so
// both rows are written or neither is. `planDay` attaches it to a plan day.
export async function saveRun(
  userId: string,
  run: RunEntry,
  planDay: RunPlanDay | null,
): Promise<void> {
  const startedAt = new Date(`${run.date}${STORED_HOUR_UTC}`);
  await prisma.workout.create({
    data: {
      userId,
      planId: planDay?.planId ?? null,
      planDayId: planDay?.planDayId ?? null,
      source: MANUAL_RUN_SOURCE,
      startedAt,
      finishedAt: new Date(
        startedAt.getTime() + run.durationSec * MS_PER_SECOND,
      ),
      distanceKm: run.distanceKm,
      durationSeconds: run.durationSec,
      notes: run.note,
      run: {
        create: {
          type: planDay?.runType ?? null,
          distanceKm: run.distanceKm,
          durationSec: run.durationSec,
          rpe: run.effort,
        },
      },
    },
    select: { id: true },
  });
}
