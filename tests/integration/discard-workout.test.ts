// Integration test for Discard workout (D47) against a real PostgreSQL: the owner removes an
// unfinished workout and its sets; another user's id and a finished workout answer 404 and
// change nothing.
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
vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`);
  },
  notFound: () => {
    throw new Error("not-found");
  },
}));
vi.mock("@/lib/auth/session", () => ({ requireUser }));
vi.mock("@/lib/prisma", async () => {
  const { testDatabase } = await import("../helpers/database");
  return { prisma: testDatabase() };
});

import { discardWorkout } from "@/app/session/discardAction";
import { prisma as db } from "@/lib/prisma";

const prefix = `discard-${randomUUID()}`;
const exerciseId = `${prefix}-press`;
const LANDING = "redirect:/session";
const SET_NUMBERS = [1, 2];
const SETS_LOGGED = SET_NUMBERS.length;
const REPS = 5;
let sequence = 0;

function athlete() {
  return db.user.create({
    data: {
      name: "Discard athlete",
      email: `${prefix}-${sequence++}@example.test`,
      emailVerified: true,
    },
  });
}

// One workout with two logged sets; finished or not.
async function workoutWithSets(userId: string, finished: boolean) {
  const workout = await db.workout.create({
    data: {
      userId,
      finishedAt: finished ? new Date("2026-11-25T16:00:00Z") : null,
    },
  });
  await db.setLog.createMany({
    data: SET_NUMBERS.map((setNumber) => ({
      workoutId: workout.id,
      exerciseId,
      setNumber,
      reps: REPS,
    })),
  });
  return workout;
}

const setCount = (workoutId: number) =>
  db.setLog.count({ where: { workoutId } });

beforeAll(async () => {
  await db.exercise.create({
    data: {
      id: exerciseId,
      name: "Discard Press",
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

describe("discardWorkout with PostgreSQL", () => {
  it("removes the owner's unfinished workout and its sets, then returns to the landing", async () => {
    const owner = await athlete();
    const workout = await workoutWithSets(owner.id, false);
    requireUser.mockResolvedValue(owner);

    await expect(discardWorkout(workout.id)).rejects.toThrow(LANDING);

    expect(
      await db.workout.findUnique({ where: { id: workout.id } }),
    ).toBeNull();
    expect(await setCount(workout.id)).toBe(0);
  });

  it("leaves the owner's other workouts alone", async () => {
    const owner = await athlete();
    const discarded = await workoutWithSets(owner.id, false);
    const kept = await workoutWithSets(owner.id, true);
    requireUser.mockResolvedValue(owner);

    await expect(discardWorkout(discarded.id)).rejects.toThrow(LANDING);

    expect(await setCount(kept.id)).toBe(SETS_LOGGED);
  });

  it("answers 404 for another user's workout and deletes nothing", async () => {
    const owner = await athlete();
    const intruder = await athlete();
    const workout = await workoutWithSets(owner.id, false);
    requireUser.mockResolvedValue(intruder);

    await expect(discardWorkout(workout.id)).rejects.toThrow("not-found");

    expect(
      await db.workout.findUnique({ where: { id: workout.id } }),
    ).not.toBeNull();
    expect(await setCount(workout.id)).toBe(SETS_LOGGED);
  });

  it("refuses a finished workout: 404, and its sets stay", async () => {
    const owner = await athlete();
    const workout = await workoutWithSets(owner.id, true);
    requireUser.mockResolvedValue(owner);

    await expect(discardWorkout(workout.id)).rejects.toThrow("not-found");

    expect(
      await db.workout.findUnique({ where: { id: workout.id } }),
    ).not.toBeNull();
    expect(await setCount(workout.id)).toBe(SETS_LOGGED);
  });

  it("answers 404 for a workout that does not exist", async () => {
    const owner = await athlete();
    requireUser.mockResolvedValue(owner);
    const missing = 2_000_000_000;

    await expect(discardWorkout(missing)).rejects.toThrow("not-found");
  });
});
