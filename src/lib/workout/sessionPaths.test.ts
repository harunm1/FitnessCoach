import { describe, expect, it } from "vitest";
import { SESSION_LANDING, parseWorkoutId, workoutPath } from "./sessionPaths";

describe("session paths (D43)", () => {
  it("gives a workout its own address and the landing stays /session", () => {
    expect(SESSION_LANDING).toBe("/session");
    expect(workoutPath(42)).toBe("/session/42");
  });

  it("reads a whole positive number from the address and nothing else", () => {
    expect(parseWorkoutId("42")).toBe(42);
    for (const bad of ["", "0", "-3", "4.5", "12abc", " 7", "1e3", "٣"]) {
      expect(parseWorkoutId(bad)).toBeNull();
    }
    expect(parseWorkoutId("99999999999999999999")).toBeNull();
  });
});
