import { describe, expect, it, vi } from "vitest";
import { formatPrevious, loadPreviousSets } from "./previousSets";

describe("loadPreviousSets", () => {
  const fakeDb = (
    newestByExercise: Record<string, number>,
    setsByWorkout: Record<number, unknown[]>,
  ) => {
    const findFirst = vi.fn(async ({ where }) =>
      where.exerciseId in newestByExercise
        ? { workoutId: newestByExercise[where.exerciseId] }
        : null,
    );
    const findMany = vi.fn(async ({ where }) => setsByWorkout[where.workoutId]);
    return {
      db: { setLog: { findFirst, findMany } } as never,
      findFirst,
      findMany,
    };
  };

  it("takes each exercise's newest finished workout, whenever it was, and only this user's", async () => {
    const { db, findFirst } = fakeDb(
      { bench: 9, squat: 3 },
      {
        9: [{ setNumber: 1, reps: 8, weightKg: { toString: () => "62.50" } }],
        3: [{ setNumber: 1, reps: 5, weightKg: null }],
      },
    );
    const result = await loadPreviousSets(db, "u1", ["bench", "squat", "row"]);
    expect(result.get("bench")).toEqual([
      { setNumber: 1, reps: 8, weightKg: "62.50" },
    ]);
    expect(result.get("squat")).toEqual([
      { setNumber: 1, reps: 5, weightKg: null },
    ]);
    expect(result.has("row")).toBe(false);
    expect(findFirst.mock.calls[0][0].where).toEqual({
      exerciseId: "bench",
      workout: { userId: "u1", finishedAt: { not: null } },
    });
  });

  it("asks nothing for no exercises", async () => {
    const { db, findFirst } = fakeDb({}, {});
    expect(await loadPreviousSets(db, "u1", [])).toEqual(new Map());
    expect(findFirst).not.toHaveBeenCalled();
  });
});

describe("formatPrevious", () => {
  it("shows weight x reps in the user's unit, reps alone, or a dash", () => {
    expect(
      formatPrevious({ setNumber: 1, reps: 8, weightKg: "60" }, "KG"),
    ).toBe("60 kg × 8");
    expect(
      formatPrevious({ setNumber: 1, reps: 8, weightKg: "60" }, "LB"),
    ).toBe("132.5 lb × 8");
    expect(
      formatPrevious({ setNumber: 2, reps: 12, weightKg: null }, "KG"),
    ).toBe("12 reps");
    expect(formatPrevious(undefined, "KG")).toBe("-");
  });
});
