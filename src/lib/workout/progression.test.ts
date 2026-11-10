import { describe, expect, it } from "vitest";
import { getNextPlanDayIndex } from "./progression";

describe("getNextPlanDayIndex", () => {
  it("starts at the first day when no workouts are complete", () => {
    expect(getNextPlanDayIndex(0, 3)).toBe(0);
  });

  it("advances to the next plan day after each completion", () => {
    expect(getNextPlanDayIndex(1, 3)).toBe(1);
    expect(getNextPlanDayIndex(2, 3)).toBe(2);
  });

  it("cycles back to the first day after the last plan day", () => {
    expect(getNextPlanDayIndex(3, 3)).toBe(0);
    expect(getNextPlanDayIndex(4, 3)).toBe(1);
  });

  it("returns null when the plan has no days", () => {
    expect(getNextPlanDayIndex(0, 0)).toBeNull();
  });
});
