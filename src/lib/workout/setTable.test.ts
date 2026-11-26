import { describe, expect, it } from "vitest";
import {
  MAX_SETS_PER_EXERCISE,
  canAddSet,
  canRemoveSet,
  checkInStops,
  exerciseKind,
  formatRestChoice,
  initialRowCount,
  parseCheckIn,
  restChoicesWith,
} from "./setTable";

describe("exerciseKind", () => {
  it("is reps only for body-only exercises and weight x reps for the rest", () => {
    expect(exerciseKind("body only")).toBe("REPS_ONLY");
    expect(exerciseKind("Body Only")).toBe("REPS_ONLY");
    expect(exerciseKind("barbell")).toBe("WEIGHT_REPS");
    expect(exerciseKind("dumbbell")).toBe("WEIGHT_REPS");
    expect(exerciseKind(null)).toBe("WEIGHT_REPS");
  });
});

describe("rows", () => {
  it("starts at the plan's sets, or the logged sets if more, within the limit", () => {
    expect(initialRowCount(3, 0)).toBe(3);
    expect(initialRowCount(3, 5)).toBe(5);
    expect(initialRowCount(0, 0)).toBe(1);
    expect(initialRowCount(9, 0)).toBe(MAX_SETS_PER_EXERCISE);
  });

  it("adds up to the limit and removes only unlogged rows, keeping one", () => {
    expect(canAddSet(MAX_SETS_PER_EXERCISE - 1)).toBe(true);
    expect(canAddSet(MAX_SETS_PER_EXERCISE)).toBe(false);
    expect(canRemoveSet(4, 2)).toBe(true);
    expect(canRemoveSet(2, 2)).toBe(false);
    expect(canRemoveSet(1, 0)).toBe(false);
  });
});

describe("rest choices", () => {
  it("lists Off to five minutes and adds the plan's own rest in order", () => {
    expect(restChoicesWith(90)).toEqual([0, 30, 45, 60, 90, 120, 180, 300]);
    expect(restChoicesWith(75)).toEqual([0, 30, 45, 60, 75, 90, 120, 180, 300]);
  });

  it("names a choice", () => {
    expect(formatRestChoice(0)).toBe("Off");
    expect(formatRestChoice(45)).toBe("45s");
    expect(formatRestChoice(90)).toBe("1:30");
    expect(formatRestChoice(300)).toBe("5:00");
  });
});

describe("pain check-in", () => {
  it("reads a whole number from 0 to 10 and treats blank or odd input as skipped", () => {
    expect(parseCheckIn("0")).toBe(0);
    expect(parseCheckIn(" 7 ")).toBe(7);
    expect(parseCheckIn("10")).toBe(10);
    for (const bad of ["", "11", "-1", "2.5", "abc", "100"]) {
      expect(parseCheckIn(bad)).toBeNull();
    }
  });

  it("stops at the saved stop range (6 or more) and never when skipped", () => {
    expect(checkInStops(null)).toBe(false);
    expect(checkInStops(5)).toBe(false);
    expect(checkInStops(6)).toBe(true);
    expect(checkInStops(10)).toBe(true);
  });
});
