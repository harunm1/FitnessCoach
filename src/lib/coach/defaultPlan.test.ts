import { describe, expect, it } from "vitest";
import { buildDefaultPlan } from "./defaultPlan";
import type { LibraryExercise, VerifyProfile } from "./verify";

const profile: VerifyProfile = {
  daysPerWeek: 1,
  equipment: ["barbell"],
  avoidMuscles: [],
};

const library: LibraryExercise[] = [
  {
    id: "bench-press",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
  },
  {
    id: "barbell-squat",
    equipment: "barbell",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes"],
  },
  {
    id: "barbell-row",
    equipment: "barbell",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps"],
  },
];

describe("buildDefaultPlan", () => {
  it("fills a day with at least two unique compatible exercises", () => {
    const plan = buildDefaultPlan(profile, library);

    expect(plan.days).toHaveLength(1);
    expect(plan.days[0]?.exercises.length).toBeGreaterThanOrEqual(2);
    expect(
      new Set(plan.days[0]?.exercises.map((exercise) => exercise.exerciseId))
        .size,
    ).toBe(plan.days[0]?.exercises.length);
  });

  it("uses other compatible library exercises when a split has too few matches", () => {
    const plan = buildDefaultPlan(profile, library.slice(0, 2));

    expect(
      plan.days[0]?.exercises.map((exercise) => exercise.exerciseId),
    ).toEqual(["barbell-squat", "bench-press"]);
  });

  it("rejects a library that cannot provide two safe exercises for every day", () => {
    expect(() => buildDefaultPlan(profile, library.slice(0, 1))).toThrow(
      "Not enough compatible exercises for Full body",
    );
  });
});
