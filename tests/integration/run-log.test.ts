// Integration test for runs logged by hand (D27) against a real PostgreSQL: the
// Server Action writes a finished Workout and its RunLog together, completes the
// plan's next run day, keeps rows with their owner, and the migration's CHECKs
// refuse what the form refuses.
import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});

import { logRun } from "@/app/progress/run/actions";
import { prisma as db } from "@/lib/prisma";
import { loadFinishedWorkouts } from "@/lib/progress/load";
import { loadRecentRuns } from "@/lib/progress/loadRuns";
import { getNextPlanDayIndex } from "@/lib/workout/progression";

const prefix = `run-${randomUUID()}`;
let sequence = 0;
const idle = { status: "idle" as const };
const RUN = {
  date: "2026-11-23",
  distanceKm: "5.2",
  duration: "0:31:12",
  effort: "6",
  note: "Easy loop",
};

function athlete() {
  return db.user.create({
    data: {
      name: "Run athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
    },
  });
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  Object.entries(fields).forEach(([name, value]) => data.append(name, value));
  return data;
}

// An active plan, Push then Easy run, made on 20 Nov, with Push already done.
async function planWithRunNext(userId: string) {
  const plan = await db.plan.create({
    data: {
      userId,
      name: "Hybrid week",
      source: "DEFAULT",
      createdAt: new Date("2026-11-20T14:00:00Z"),
      days: {
        create: [
          { dayIndex: 0, name: "Push", kind: "STRENGTH" },
          {
            dayIndex: 1,
            name: "Easy run",
            kind: "RUN",
            run: { create: { type: "EASY", distanceKm: 5 } },
          },
        ],
      },
    },
    include: { days: { orderBy: { dayIndex: "asc" } } },
  });
  await db.workout.create({
    data: {
      userId,
      planId: plan.id,
      planDayId: plan.days[0].id,
      startedAt: new Date("2026-11-21T15:00:00Z"),
      finishedAt: new Date("2026-11-21T16:00:00Z"),
    },
  });
  return plan;
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"], now: new Date("2026-11-24T15:00:00Z") });
});

afterAll(async () => {
  vi.useRealTimers();
  // Workouts and their RunLogs go with their users (onDelete: Cascade).
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.$disconnect();
});

describe("runs logged by hand on PostgreSQL", () => {
  it("saves a finished workout and its RunLog, shown in the list and the calendar", async () => {
    const user = await athlete();
    requireUser.mockResolvedValue({ id: user.id });

    const result = await logRun(idle, form(RUN));
    expect(result).toMatchObject({ status: "saved", pace: "6:00 /km" });

    const saved = await db.workout.findFirstOrThrow({
      where: { userId: user.id },
      include: { run: true },
    });
    expect(saved.source).toBe("manual-run");
    expect(saved.planDayId).toBeNull();
    expect(saved.run).toMatchObject({ durationSec: 1872, rpe: 6, type: null });
    expect(saved.run?.distanceKm.toString()).toBe("5.2");

    expect(await loadRecentRuns(user.id)).toEqual([
      expect.objectContaining({
        day: "2026-11-23",
        distanceKm: 5.2,
        time: "31:12",
        effort: 6,
        note: "Easy loop",
      }),
    ]);
    const calendar = await loadFinishedWorkouts(
      user.id,
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(calendar).toEqual([
      expect.objectContaining({
        distanceKm: 5.2,
        runSeconds: 1872,
        imported: false,
      }),
    ]);
  });

  it("completes the plan's next run day, so the rotation moves on", async () => {
    const user = await athlete();
    requireUser.mockResolvedValue({ id: user.id });
    const plan = await planWithRunNext(user.id);

    const result = await logRun(idle, form(RUN));
    expect(result).toMatchObject({ status: "saved", planDayName: "Easy run" });

    const run = await db.workout.findFirstOrThrow({
      where: { userId: user.id, source: "manual-run" },
      include: { run: true },
    });
    expect(run.planId).toBe(plan.id);
    expect(run.planDayId).toBe(plan.days[1].id);
    expect(run.run?.type).toBe("EASY");
    // The session screen's count: two finished workouts, so Push is next again.
    const finished = await db.workout.count({
      where: { userId: user.id, planId: plan.id, finishedAt: { not: null } },
    });
    expect(getNextPlanDayIndex(finished, plan.days.length)).toBe(0);
  });

  it("leaves the run day for the session screen while a session is open", async () => {
    const user = await athlete();
    requireUser.mockResolvedValue({ id: user.id });
    const plan = await planWithRunNext(user.id);
    await db.workout.create({
      data: { userId: user.id, planId: plan.id, planDayId: plan.days[1].id },
    });

    const result = await logRun(idle, form(RUN));
    expect(result).toMatchObject({ status: "saved", planDayName: null });
    const run = await db.workout.findFirstOrThrow({
      where: { userId: user.id, source: "manual-run" },
    });
    expect(run.planId).toBeNull();
  });

  it("shows each user only their own runs", async () => {
    const owner = await athlete();
    const other = await athlete();
    requireUser.mockResolvedValue({ id: other.id });
    await logRun(idle, form(RUN));

    expect(await loadRecentRuns(owner.id)).toEqual([]);
    expect(await loadRecentRuns(other.id)).toHaveLength(1);
  });

  it("refuses a RunLog over 300 km or 24 hours at the database too", async () => {
    const user = await athlete();
    const workout = await db.workout.create({
      data: { userId: user.id, finishedAt: new Date() },
    });
    await expect(
      db.runLog.create({
        data: { workoutId: workout.id, distanceKm: 300.01, durationSec: 60000 },
      }),
    ).rejects.toThrow(/RunLog_distanceKm_max_check/);
    await expect(
      db.runLog.create({
        data: { workoutId: workout.id, distanceKm: 10, durationSec: 86401 },
      }),
    ).rejects.toThrow(/RunLog_durationSec_max_check/);
  });
});
