import { describe, expect, it } from "vitest";
import {
  bestSet,
  groupInOrder,
  setLabel,
  totalVolumeKg,
  weightRecords,
  workoutName,
} from "./view";

// Live bug L5, 25 Nov 2026: the workout page gets a header with volume and records.
describe("totalVolumeKg", () => {
  it("adds reps times weight over every set, skipping bodyweight sets", () => {
    expect(
      totalVolumeKg([
        {
          sets: [
            { reps: 10, weightKg: 60 },
            { reps: 8, weightKg: 62.5 },
          ],
        },
        { sets: [{ reps: 12, weightKg: null }] },
      ]),
    ).toBe(1100);
  });

  it("is zero with no sets", () => {
    expect(totalVolumeKg([])).toBe(0);
  });
});

describe("weightRecords", () => {
  const bench = { id: "bench", sets: [{ weightKg: 60 }, { weightKg: 65 }] };
  const row = { id: "row", sets: [{ weightKg: 50 }] };
  const pushups = { id: "pushups", sets: [{ weightKg: null }] };

  it("lists exercises whose top weight beats everything lifted before", () => {
    expect(weightRecords([bench, row], { bench: 62.5, row: 50 })).toEqual([
      "bench",
    ]);
  });

  it("does not call a first time a record, or a bodyweight exercise", () => {
    expect(weightRecords([bench, pushups], { pushups: 0 })).toEqual([]);
  });
});

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

describe("setLabel in pounds", () => {
  it("converts the stored kilograms and names the unit", () => {
    expect(setLabel({ reps: 8, weightKg: 61.23, rpe: 8 }, "LB")).toBe(
      "8 reps × 135 lb · RPE 8",
    );
    expect(setLabel({ reps: 12, weightKg: null, rpe: null }, "LB")).toBe(
      "12 reps",
    );
  });
});

describe("setLabel", () => {
  it("shows reps, kg and RPE when each was logged", () => {
    expect(setLabel({ reps: 8, weightKg: 60, rpe: 8 })).toBe(
      "8 reps × 60 kg · RPE 8",
    );
    expect(setLabel({ reps: 12, weightKg: null, rpe: null })).toBe("12 reps");
    expect(setLabel({ reps: 1, weightKg: 100, rpe: null })).toBe(
      "1 rep × 100 kg",
    );
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

describe("groupInOrder", () => {
  it("keeps groups in first-seen order and items in their order", () => {
    const groups = groupInOrder(["b1", "a1", "b2"], (item) => item[0]);
    expect([...groups]).toEqual([
      ["b", ["b1", "b2"]],
      ["a", ["a1"]],
    ]);
  });
});
