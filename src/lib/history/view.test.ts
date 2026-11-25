import { describe, expect, it } from "vitest";
import {
  bestSet,
  groupInOrder,
  minutesBetween,
  setLabel,
  topWeightLine,
  workoutName,
} from "./view";

describe("workoutName", () => {
  it("uses the plan day's name", () => {
    expect(
      workoutName({
        planDayName: "Push",
        imported: false,
        notes: "x",
        isRun: false,
      }),
    ).toBe("Push");
  });

  it("uses an imported workout's title, which the import saved in notes", () => {
    expect(
      workoutName({
        planDayName: null,
        imported: true,
        notes: "Leg day",
        isRun: false,
      }),
    ).toBe("Leg day");
  });

  it("never takes a live workout's notes as its name", () => {
    expect(
      workoutName({
        planDayName: null,
        imported: false,
        notes: "felt tired",
        isRun: false,
      }),
    ).toBe("Workout");
    expect(
      workoutName({
        planDayName: null,
        imported: false,
        notes: null,
        isRun: true,
      }),
    ).toBe("Run");
  });
});

describe("minutesBetween", () => {
  it("rounds to whole minutes and never shows zero", () => {
    const start = new Date("2026-11-08T17:00:00Z");
    expect(minutesBetween(start, new Date("2026-11-08T17:50:20Z"))).toBe(50);
    expect(minutesBetween(start, start)).toBe(1);
  });
});

describe("setLabel", () => {
  it("shows reps, kg and RPE when each was logged", () => {
    expect(setLabel({ reps: 8, weightKg: 60, rpe: 8 })).toBe(
      "8 reps × 60 kg · RPE 8",
    );
    expect(setLabel({ reps: 12, weightKg: null, rpe: null })).toBe("12 reps");
  });
});

describe("bestSet", () => {
  it("picks the heaviest set, then the most reps at that weight", () => {
    const sets = [
      { reps: 10, weightKg: 50, rpe: null },
      { reps: 5, weightKg: 60, rpe: 9 },
      { reps: 6, weightKg: 60, rpe: null },
    ];
    expect(bestSet(sets)).toEqual({ reps: 6, weightKg: 60, rpe: null });
  });

  it("picks the most reps when no set had a weight", () => {
    const sets = [
      { reps: 10, weightKg: null, rpe: null },
      { reps: 15, weightKg: null, rpe: null },
    ];
    expect(bestSet(sets)).toEqual({ reps: 15, weightKg: null, rpe: null });
  });

  it("ranks any weighted set above a bodyweight one", () => {
    const sets = [
      { reps: 30, weightKg: null, rpe: null },
      { reps: 1, weightKg: 2.5, rpe: null },
    ];
    expect(bestSet(sets)?.weightKg).toBe(2.5);
  });

  it("returns null for no sets", () => {
    expect(bestSet([])).toBeNull();
  });
});

describe("topWeightLine", () => {
  it("needs two weighted workouts to draw a line", () => {
    expect(topWeightLine([])).toBeNull();
    expect(topWeightLine([60])).toBeNull();
    expect(topWeightLine([null, 60, null])).toBeNull();
  });

  it("spreads the points across the box, heaviest at the top", () => {
    const line = topWeightLine([40, 60, 50], { width: 100, height: 40 });
    expect(line).toEqual({
      points: "0,40 50,0 100,20",
      min: 40,
      max: 60,
      count: 3,
    });
  });

  it("skips workouts without a weight and draws a flat line mid-box", () => {
    const line = topWeightLine([50, null, 50], { width: 100, height: 40 });
    expect(line).toEqual({ points: "0,20 100,20", min: 50, max: 50, count: 2 });
  });
});

describe("groupInOrder", () => {
  it("keeps groups in first-seen order and items in their order", () => {
    const groups = groupInOrder(["b1", "a1", "b2"], (item) => item[0]);
    expect([...groups]).toEqual([
      ["b", ["b1", "b2"]],
      ["a", ["a1"]],
    ]);
  });
});
