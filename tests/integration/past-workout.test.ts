// Integration test for Log a past workout (D49, #194) against a real PostgreSQL: the owner's
// strength workout is one finished Workout with its sets, shows in History and Progress and
// counts toward streaks; another user never sees or receives it; a future day, an unknown
// exercise and a forged owner write nothing; a past run goes through the same page.
import { randomUUID } from "node:crypto";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { requireUser } = vi.hoisted(() => ({ requireUser: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});

import { logPastStrength } from "@/app/history/log/actions";
import { logRun } from "@/app/progress/run/actions";
import { loadHistoryPage, loadWorkoutDetail } from "@/lib/history/load";
import { prisma as db } from "@/lib/prisma";
import { dayKey } from "@/lib/progress/dates";
import { loadFinishedWorkouts } from "@/lib/progress/load";
import { streakInput } from "@/lib/progress/streakInput";
import { activeWeekStreak } from "@/lib/progress/streaks";

const prefix = `past-${randomUUID()}`;
const exerciseId = `${prefix}-press`;
const idle = { status: "idle" as const };
const PAST_DAY = "2026-11-23";
const FIRST_PAGE = 1;
const GOAL_DAYS = 3;
const SINCE = new Date("2026-01-01T00:00:00Z");
let sequence = 0;

function athlete() {
  return db.user.create({
    data: {
      name: "Past athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
    },
  });
}

const entry = (changes: Record<string, unknown> = {}) =>
  JSON.stringify({
    date: PAST_DAY,
    minutes: "45",
    note: "Gym was closed on Sunday, did it at home",
    exercises: [
      {
        exerciseId,
        sets: [
          { reps: "8", weight: "60" },
          { reps: "6", weight: "62.5" },
        ],
      },
    ],
    ...changes,
  });

function form(json: string, extra: Record<string, string> = {}) {
  const data = new FormData();
  data.append("entry", json);
  Object.entries(extra).forEach(([name, value]) => data.append(name, value));
  return data;
}

const workoutsOf = (userId: string) =>
  db.workout.findMany({ where: { userId }, include: { sets: true } });

beforeAll(async () => {
  await db.exercise.create({
    data: {
      id: exerciseId,
      name: "Past Press",
      level: "BEGINNER",
      category: "strength",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
      instructions: [],
      images: [],
      cues: [],
      commonMistakes: [],
    },
  });
});

beforeEach(() => requireUser.mockReset());

// Users go first: their workouts and sets are deleted with them.
afterAll(async () => {
  await db.user.deleteMany({ where: { email: { startsWith: prefix } } });
  await db.exercise.deleteMany({ where: { id: exerciseId } });
  await db.$disconnect();
});

describe("Log a past workout with PostgreSQL", () => {
  it("saves the owner's strength workout as one finished workout with numbered sets", async () => {
    const owner = await athlete();
    requireUser.mockResolvedValue({ id: owner.id });

    const state = await logPastStrength(idle, form(entry()));

    expect(state).toEqual({
      status: "saved",
      date: PAST_DAY,
      exercises: 1,
      sets: 2,
    });
    const [workout] = await workoutsOf(owner.id);
    expect(workout).toMatchObject({
      userId: owner.id,
      source: "manual-strength",
      planId: null,
      planDayId: null,
      activeSince: null,
      durationSeconds: 2700,
      notes: "Gym was closed on Sunday, did it at home",
    });
    expect(workout.startedAt).toEqual(new Date(`${PAST_DAY}T17:00:00Z`));
    expect(workout.finishedAt).toEqual(new Date(`${PAST_DAY}T17:45:00Z`));
    expect(
      workout.sets
        .map((set) => [set.setNumber, set.reps, Number(set.weightKg)])
        .sort(),
    ).toEqual([
      [1, 8, 60],
      [2, 6, 62.5],
    ]);
  });

  it("shows in History and Progress and counts toward the streaks like any workout", async () => {
    const owner = await athlete();
    requireUser.mockResolvedValue({ id: owner.id });
    // A day inside the current week, so the streak is live.
    const today = dayKey(new Date());
    await logPastStrength(idle, form(entry({ date: today })));

    const history = await loadHistoryPage(owner.id, FIRST_PAGE);
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0]).toMatchObject({ sets: 2, imported: false });

    const progress = await loadFinishedWorkouts(owner.id, SINCE);
    expect(progress).toHaveLength(1);
    expect(progress[0]).toMatchObject({ manual: true, imported: false });
    expect(progress[0].sets).toHaveLength(2);
    expect(activeWeekStreak(streakInput(progress, GOAL_DAYS), new Date())).toBe(
      1,
    );

    const detail = await loadWorkoutDetail(owner.id, history.rows[0].id);
    expect(detail?.exercises[0].name).toBe("Past Press");
  });

  it("never shows or gives a workout to another user, whatever the form says", async () => {
    const owner = await athlete();
    const other = await athlete();
    requireUser.mockResolvedValue({ id: owner.id });
    await logPastStrength(idle, form(entry()));
    const [workout] = await workoutsOf(owner.id);

    // The other user cannot read it ...
    expect((await loadHistoryPage(other.id, FIRST_PAGE)).rows).toHaveLength(0);
    expect(await loadWorkoutDetail(other.id, workout.id)).toBeNull();

    // ... and a form that names the owner saves under the signed-in user instead.
    requireUser.mockResolvedValue({ id: other.id });
    await logPastStrength(idle, form(entry(), { userId: owner.id }));
    expect(await workoutsOf(owner.id)).toHaveLength(1);
    const [mine] = await workoutsOf(other.id);
    expect(mine.userId).toBe(other.id);
  });

  it("refuses a future day and writes nothing", async () => {
    const owner = await athlete();
    requireUser.mockResolvedValue({ id: owner.id });
    const tomorrow = new Date(Date.now() + 36 * 60 * 60 * 1000);

    const state = await logPastStrength(
      idle,
      form(entry({ date: dayKey(tomorrow) })),
    );

    expect(state).toEqual({
      status: "error",
      message: "That day hasn't happened yet.",
    });
    expect(await workoutsOf(owner.id)).toHaveLength(0);
  });

  it("refuses an exercise that is not in the library and writes nothing", async () => {
    const owner = await athlete();
    requireUser.mockResolvedValue({ id: owner.id });

    const state = await logPastStrength(
      idle,
      form(
        entry({
          exercises: [
            { exerciseId: `${prefix}-nope`, sets: [{ reps: "5", weight: "" }] },
          ],
        }),
      ),
    );

    expect(state).toEqual({
      status: "error",
      message: "Choose each exercise from the list.",
    });
    expect(await workoutsOf(owner.id)).toHaveLength(0);
  });

  it("logs a past run through the same page, and refuses a future one", async () => {
    const owner = await athlete();
    requireUser.mockResolvedValue({ id: owner.id });
    const run = {
      distanceKm: "5.2",
      duration: "0:31:12",
      effort: "6",
      note: "Easy loop",
    };

    const saved = await logRun(idle, form("", { ...run, date: PAST_DAY }));
    expect(saved.status).toBe("saved");
    const tomorrow = dayKey(new Date(Date.now() + 36 * 60 * 60 * 1000));
    const refused = await logRun(idle, form("", { ...run, date: tomorrow }));
    expect(refused).toMatchObject({
      status: "error",
      message: "That day hasn't happened yet.",
    });

    const history = await loadHistoryPage(owner.id, FIRST_PAGE);
    expect(history.rows).toHaveLength(1);
    expect(history.rows[0].name).toBe("Run");
  });
});
