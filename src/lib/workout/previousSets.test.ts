import { describe, expect, it, vi } from "vitest";
import {
  formatPrevious,
  loadPreviousSets,
  newestWorkoutSets,
} from "./previousSets";

const row = (
  exerciseId: string,
  workoutId: number,
  setNumber: number,
  reps: number,
  weightKg: string | null,
) => ({ exerciseId, workoutId, setNumber, reps, weightKg });

describe("newestWorkoutSets", () => {
  it("keeps only the newest workout's sets for each exercise", () => {
    // Rows arrive newest workout first, as the query orders them.
    const byExercise = newestWorkoutSets([
      row("bench", 9, 1, 8, "60"),
      row("bench", 9, 2, 8, "62.5"),
      row("squat", 9, 1, 5, "100"),
      row("bench", 4, 1, 10, "50"),
      row("squat", 3, 1, 5, "90"),
    ]);
    expect(byExercise.get("bench")).toEqual([
      { setNumber: 1, reps: 8, weightKg: "60" },
      { setNumber: 2, reps: 8, weightKg: "62.5" },
    ]);
    expect(byExercise.get("squat")).toEqual([
      { setNumber: 1, reps: 5, weightKg: "100" },
    ]);
  });
});

describe("loadPreviousSets", () => {
  it("reads only this user's finished workouts and skips the query for no exercises", async () => {
    const findMany = vi.fn().mockResolvedValue([]);
    const db = { setLog: { findMany } } as never;
    expect(await loadPreviousSets(db, "u1", [])).toEqual(new Map());
    expect(findMany).not.toHaveBeenCalled();
    await loadPreviousSets(db, "u1", ["bench"]);
    expect(findMany.mock.calls[0][0].where).toEqual({
      exerciseId: { in: ["bench"] },
      workout: { userId: "u1", finishedAt: { not: null } },
    });
  });

  it("turns database decimals into strings", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        workoutId: 2,
        exerciseId: "bench",
        setNumber: 1,
        reps: 8,
        weightKg: { toString: () => "62.50" },
      },
    ]);
    const result = await loadPreviousSets(
      { setLog: { findMany } } as never,
      "u1",
      ["bench"],
    );
    expect(result.get("bench")).toEqual([
      { setNumber: 1, reps: 8, weightKg: "62.50" },
    ]);
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
