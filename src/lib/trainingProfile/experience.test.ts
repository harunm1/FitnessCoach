import { describe, expect, it } from "vitest";
import { EXPERT_MIN, INTERMEDIATE_MIN, experienceLevel } from "./experience";

const facts = (
  monthsSinceFirst: number,
  activeWeeksOf26: number,
  perWeekRecent: number,
) => ({ monthsSinceFirst, activeWeeksOf26, perWeekRecent });

describe("experienceLevel (D34)", () => {
  it("states the thresholds", () => {
    expect(INTERMEDIATE_MIN).toEqual({
      months: 6,
      activeWeeks: 13,
      perWeek: 2,
    });
    expect(EXPERT_MIN).toEqual({ months: 24, activeWeeks: 20, perWeek: 3 });
  });

  it("is BEGINNER with no history", () => {
    expect(experienceLevel(facts(0, 0, 0))).toBe("BEGINNER");
  });

  it("stays BEGINNER under six months, however often the user trains", () => {
    expect(experienceLevel(facts(5, 20, 6))).toBe("BEGINNER");
  });

  it("is INTERMEDIATE at six months, 13 active weeks of 26 and 2 workouts a week", () => {
    expect(experienceLevel(facts(6, 13, 2))).toBe("INTERMEDIATE");
  });

  it("stays BEGINNER at six months when only 12 of the last 26 weeks were active", () => {
    expect(experienceLevel(facts(6, 12, 3))).toBe("BEGINNER");
  });

  it("stays BEGINNER when the last eight weeks fell below 2 workouts a week", () => {
    expect(experienceLevel(facts(12, 20, 1.9))).toBe("BEGINNER");
  });

  it("is EXPERT at 24 months, 20 active weeks and 3 workouts a week", () => {
    expect(experienceLevel(facts(24, 20, 3))).toBe("EXPERT");
  });

  it("is INTERMEDIATE after three years at 2.5 workouts a week", () => {
    expect(experienceLevel(facts(36, 22, 2.5))).toBe("INTERMEDIATE");
  });

  it("is INTERMEDIATE at 24 months with only 19 active weeks", () => {
    expect(experienceLevel(facts(24, 19, 4))).toBe("INTERMEDIATE");
  });
});
