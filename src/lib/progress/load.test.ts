import { beforeEach, describe, expect, it, vi } from "vitest";

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { workout: { findMany } } }));
import { loadFinishedWorkouts } from "./load";

const since = new Date("2025-11-01T00:00:00Z");

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    startedAt: new Date("2026-11-08T17:00:00Z"),
    finishedAt: new Date("2026-11-08T17:50:00Z"),
    distanceKm: null,
    durationSeconds: null,
    planDay: { name: "Push" },
    plan: {
      days: [{ kind: "STRENGTH" }, { kind: "RUN" }, { kind: "REST" }],
    },
    sets: [
      {
        setNumber: 1,
        reps: 10,
        weightKg: { toString: () => "42.50" },
        exercise: {
          name: "Bench Press",
          category: "strength",
          primaryMuscles: ["chest"],
          secondaryMuscles: ["triceps"],
        },
      },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  findMany.mockResolvedValue([row()]);
});

describe("loadFinishedWorkouts", () => {
  it("asks only for the user's finished workouts since the date, oldest first", async () => {
    await loadFinishedWorkouts("user-1", since);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: "user-1",
          startedAt: { gte: since },
          finishedAt: { not: null },
        },
        orderBy: { startedAt: "asc" },
      }),
    );
  });

  it("turns database rows into plain progress workouts", async () => {
    expect(await loadFinishedWorkouts("user-1", since)).toEqual([
      {
        id: 7,
        startedAt: new Date("2026-11-08T17:00:00Z"),
        finishedAt: new Date("2026-11-08T17:50:00Z"),
        dayName: "Push",
        planDays: 2,
        distanceKm: null,
        runSeconds: null,
        sets: [
          {
            exerciseName: "Bench Press",
            category: "strength",
            primaryMuscles: ["chest"],
            secondaryMuscles: ["triceps"],
            setNumber: 1,
            reps: 10,
            weightKg: 42.5,
          },
        ],
      },
    ]);
  });

  it("keeps a logged run and handles a workout without a plan", async () => {
    findMany.mockResolvedValue([
      row({
        planDay: null,
        plan: null,
        distanceKm: { toString: () => "5.20" },
        durationSeconds: 1800,
        sets: [],
      }),
    ]);
    const [workout] = await loadFinishedWorkouts("user-1", since);
    expect(workout).toMatchObject({
      dayName: null,
      planDays: 0,
      distanceKm: 5.2,
      runSeconds: 1800,
      sets: [],
    });
  });

  it("keeps a bodyweight set's missing weight empty", async () => {
    const bodyweight = row();
    bodyweight.sets[0].weightKg = null as never;
    findMany.mockResolvedValue([bodyweight]);
    const [workout] = await loadFinishedWorkouts("user-1", since);
    expect(workout.sets[0].weightKg).toBeNull();
  });
});
