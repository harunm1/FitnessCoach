import { describe, expect, it } from "vitest";
import { verifyPlan, type LibraryExercise, type VerifyProfile } from "./verify";

const library = new Map<string, LibraryExercise>([
  [
    "bench",
    {
      id: "bench",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: ["triceps"],
    },
  ],
  [
    "pushup",
    {
      id: "pushup",
      equipment: "body only",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
    },
  ],
  [
    "squat",
    {
      id: "squat",
      equipment: "barbell",
      primaryMuscles: ["quadriceps"],
      secondaryMuscles: ["lower back"],
    },
  ],
  [
    "row",
    {
      id: "row",
      equipment: "cable",
      primaryMuscles: ["middle back"],
      secondaryMuscles: [],
    },
  ],
]);

const profile: VerifyProfile = {
  daysPerWeek: 1,
  equipment: ["barbell"],
  avoidMuscles: [],
};

const slot = (exerciseId: string) => ({
  exerciseId,
  sets: 3,
  reps: 10,
  restSeconds: 90,
});

describe("verifyPlan", () => {
  it("accepts a plan that fits the user and the library", () => {
    const result = verifyPlan(
      {
        name: "Push",
        days: [{ name: "Day 1", exercises: [slot("bench"), slot("pushup")] }],
      },
      profile,
      library,
    );
    expect(result.ok).toBe(true);
  });

  it("rejects a shape or range the schema does not allow", () => {
    const result = verifyPlan(
      {
        name: "Bad",
        days: [
          {
            name: "Day 1",
            exercises: [{ ...slot("bench"), sets: 12 }, slot("pushup")],
          },
        ],
      },
      profile,
      library,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.problems[0]).toMatch(/sets/);
  });

  it("rejects an exercise the library does not have", () => {
    const result = verifyPlan(
      {
        name: "P",
        days: [{ name: "Day 1", exercises: [slot("bench"), slot("made-up")] }],
      },
      profile,
      library,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.problems).toEqual([
        expect.stringContaining("not in the exercise library"),
      ]);
  });

  it("rejects equipment the user does not own, but allows body-only moves", () => {
    const result = verifyPlan(
      {
        name: "P",
        days: [{ name: "Day 1", exercises: [slot("row"), slot("pushup")] }],
      },
      profile,
      library,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.problems).toEqual([expect.stringContaining("needs cable")]);
  });

  it("rejects an exercise that works a muscle the user reported trouble with", () => {
    const result = verifyPlan(
      {
        name: "P",
        days: [{ name: "Day 1", exercises: [slot("squat"), slot("bench")] }],
      },
      { ...profile, avoidMuscles: ["lower back"] },
      library,
    );
    expect(result.ok).toBe(false);
    if (!result.ok)
      expect(result.problems).toEqual([expect.stringContaining("lower back")]);
  });

  it("rejects the same exercise twice on one day and the wrong number of days, reporting both", () => {
    const result = verifyPlan(
      {
        name: "P",
        days: [{ name: "Day 1", exercises: [slot("bench"), slot("bench")] }],
      },
      { ...profile, daysPerWeek: 2 },
      library,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.problems).toHaveLength(2);
      expect(result.problems.join("\n")).toMatch(/appears twice/);
      expect(result.problems.join("\n")).toMatch(/asked for 2/);
    }
  });
});
