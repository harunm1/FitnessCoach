import { describe, expect, it } from "vitest";
import { findExercisesForMuscle, type BodyMapExercise } from "./muscles";

const exercises: BodyMapExercise[] = [
  {
    id: "row",
    name: "Barbell Row",
    equipment: "barbell",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps"],
    instructions: [],
  },
  {
    id: "curl",
    name: "Bicep Curl",
    equipment: "dumbbell",
    primaryMuscles: ["biceps"],
    secondaryMuscles: [],
    instructions: [],
  },
  {
    id: "pull-up",
    name: "Pull-Up",
    equipment: "body only",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["Biceps"],
    instructions: [],
  },
];

describe("findExercisesForMuscle", () => {
  it("matches primary and secondary muscles case-insensitively", () => {
    expect(
      findExercisesForMuscle("BICEPS", exercises).map(({ id }) => id),
    ).toEqual(["curl", "row", "pull-up"]);
  });

  it("returns no exercises for an unknown muscle", () => {
    expect(findExercisesForMuscle("unknown", exercises)).toEqual([]);
  });
});
