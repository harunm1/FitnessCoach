import { describe, expect, it } from "vitest";
import { muscleShare, musclesWorked, type LoggedSet } from "./muscles";

// Muscle lists as they appear in the seeded library.
const benchPress: LoggedSet = {
  category: "strength",
  primaryMuscles: ["chest"],
  secondaryMuscles: ["shoulders", "triceps"],
};
const squat: LoggedSet = {
  category: "strength",
  primaryMuscles: ["quadriceps"],
  secondaryMuscles: ["calves", "glutes", "hamstrings", "lower back"],
};
const curl: LoggedSet = {
  category: "strength",
  primaryMuscles: ["biceps"],
  secondaryMuscles: ["forearms"],
};
const quadStretch: LoggedSet = {
  category: "stretching",
  primaryMuscles: ["quadriceps"],
  secondaryMuscles: ["quadriceps"],
};

describe("musclesWorked", () => {
  it("is empty with no sets", () => {
    expect(musclesWorked([])).toEqual({ primary: [], secondary: [] });
  });

  it("splits one exercise into primary and secondary muscles", () => {
    expect(musclesWorked([benchPress])).toEqual({
      primary: ["chest"],
      secondary: ["shoulders", "triceps"],
    });
  });

  it("combines exercises without duplicates", () => {
    expect(musclesWorked([benchPress, benchPress, curl])).toEqual({
      primary: ["biceps", "chest"],
      secondary: ["forearms", "shoulders", "triceps"],
    });
  });

  it("ignores stretches and cardio", () => {
    const run: LoggedSet = {
      category: "cardio",
      primaryMuscles: ["quadriceps"],
      secondaryMuscles: ["calves"],
    };
    expect(musclesWorked([quadStretch, run])).toEqual({
      primary: [],
      secondary: [],
    });
  });

  it("lists a muscle as primary when another exercise has it as secondary", () => {
    const shoulderPress: LoggedSet = {
      category: "strength",
      primaryMuscles: ["shoulders"],
      secondaryMuscles: ["triceps"],
    };
    expect(musclesWorked([benchPress, shoulderPress])).toEqual({
      primary: ["chest", "shoulders"],
      secondary: ["triceps"],
    });
  });

  it("counts other lifting categories, not just strength", () => {
    const deadlift: LoggedSet = {
      category: "powerlifting",
      primaryMuscles: ["lower back"],
      secondaryMuscles: ["glutes"],
    };
    const boxJump: LoggedSet = {
      category: "plyometrics",
      primaryMuscles: ["hamstrings"],
      secondaryMuscles: [],
    };
    expect(musclesWorked([deadlift, boxJump])).toEqual({
      primary: ["hamstrings", "lower back"],
      secondary: ["glutes"],
    });
  });
});

describe("muscleShare", () => {
  it("is empty with no workouts", () => {
    expect(muscleShare([])).toEqual([]);
  });

  it("counts the share of workouts that used each muscle", () => {
    const legDay = [squat];
    const upperDay = [benchPress, curl];
    const shares = muscleShare([legDay, legDay, legDay, upperDay]);

    expect(shares.find((s) => s.muscle === "quadriceps")).toEqual({
      muscle: "quadriceps",
      workouts: 3,
      share: 0.75,
    });
    expect(shares.find((s) => s.muscle === "chest")).toEqual({
      muscle: "chest",
      workouts: 1,
      share: 0.25,
    });
    expect(shares[0]?.workouts).toBe(3);
  });

  it("sorts by most used, then by name", () => {
    const shares = muscleShare([[benchPress], [benchPress, curl]]);
    expect(shares.map((s) => s.muscle)).toEqual([
      "chest",
      "shoulders",
      "triceps",
      "biceps",
      "forearms",
    ]);
  });

  it("leaves cardio-only workouts out of the total", () => {
    const cardio: LoggedSet = {
      category: "cardio",
      primaryMuscles: ["quadriceps"],
      secondaryMuscles: ["calves"],
    };
    const shares = muscleShare([[benchPress], [cardio]]);
    expect(shares.find((s) => s.muscle === "chest")?.share).toBe(1);
    expect(shares.find((s) => s.muscle === "quadriceps")).toBeUndefined();
  });
});
