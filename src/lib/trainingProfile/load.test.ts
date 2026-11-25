import { describe, expect, it, vi } from "vitest";
import { NOW, daysAgo, weeklyStarts } from "./fixtures";
import {
  loadTrainingProfile,
  loadWorkingWeightsFor,
  type ProfileDb,
} from "./load";

function dbWith(starts: Date[], sets: unknown[]) {
  return {
    workout: {
      findMany: vi.fn(async () => starts.map((startedAt) => ({ startedAt }))),
    },
    setLog: { findMany: vi.fn(async () => sets) },
  } as unknown as ProfileDb & {
    workout: { findMany: ReturnType<typeof vi.fn> };
    setLog: { findMany: ReturnType<typeof vi.fn> };
  };
}

const setRow = (overrides: Record<string, unknown> = {}) => ({
  reps: 3,
  weightKg: "85",
  exerciseId: "bench",
  exercise: { name: "Bench Press", equipment: "barbell" },
  workout: { startedAt: daysAgo(7) },
  ...overrides,
});

describe("loadTrainingProfile (D34)", () => {
  it("reads only the user's finished workouts, start times only", async () => {
    const db = dbWith(weeklyStarts(40, [1, 3, 5], 18), [setRow()]);
    await loadTrainingProfile(db, "owner", NOW);
    expect(db.workout.findMany).toHaveBeenCalledWith({
      where: { userId: "owner", finishedAt: { not: null } },
      orderBy: { startedAt: "asc" },
      select: { startedAt: true },
    });
  });

  it("reads set rows only from the last 8 weeks, with a weight, of that user's finished workouts", async () => {
    const db = dbWith([], []);
    await loadTrainingProfile(db, "owner", NOW);
    expect(db.setLog.findMany).toHaveBeenCalledTimes(1);
    const args = db.setLog.findMany.mock.calls[0][0];
    expect(args.where).toEqual({
      weightKg: { not: null },
      workout: {
        userId: "owner",
        finishedAt: { not: null },
        startedAt: { gte: daysAgo(56) },
      },
    });
    expect(args.select).toEqual({
      reps: true,
      weightKg: true,
      exerciseId: true,
      exercise: { select: { name: true, equipment: true } },
      workout: { select: { startedAt: true } },
    });
  });

  it("turns decimals into numbers and derives the profile", async () => {
    const db = dbWith(weeklyStarts(40, [1, 3, 5], 18), [setRow()]);
    const profile = await loadTrainingProfile(db, "owner", NOW);
    expect(profile.level).toBe("INTERMEDIATE");
    expect(profile.workingWeights).toEqual([
      expect.objectContaining({ exerciseId: "bench", weightKg: 85, reps: 3 }),
    ]);
  });

  it("is empty for a user with no workouts", async () => {
    const profile = await loadTrainingProfile(dbWith([], []), "owner", NOW);
    expect(profile.workoutCount).toBe(0);
    expect(profile.trainingSince).toBeNull();
  });
});

describe("loadWorkingWeightsFor (D34)", () => {
  it("maps each asked exercise to its working weight in kilograms", async () => {
    const db = dbWith(
      [],
      [
        setRow(),
        setRow({
          exerciseId: "squat",
          exercise: { name: "Squat", equipment: "barbell" },
          weightKg: "120",
        }),
      ],
    );
    const weights = await loadWorkingWeightsFor(
      db,
      "owner",
      ["bench", "squat"],
      NOW,
    );
    expect(weights.get("bench")).toBe(85);
    expect(weights.get("squat")).toBe(120);
    const args = db.setLog.findMany.mock.calls[0][0];
    expect(args.where.exerciseId).toEqual({ in: ["bench", "squat"] });
    expect(args.where.workout.userId).toBe("owner");
  });

  it("asks nothing for no exercises", async () => {
    const db = dbWith([], []);
    const weights = await loadWorkingWeightsFor(db, "owner", [], NOW);
    expect(weights.size).toBe(0);
    expect(db.setLog.findMany).not.toHaveBeenCalled();
  });
});
