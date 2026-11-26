import { describe, expect, it } from "vitest";
import {
  muscleShare,
  musclesWorked,
  unmappedExercises,
  type LoggedSet,
} from "./muscles";

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

  it("breaks ties by muscle name", () => {
    // Every muscle is used once, so only the name decides the order.
    const shares = muscleShare([[curl], [benchPress]]);
    expect(shares.map((s) => s.muscle)).toEqual([
      "biceps",
      "chest",
      "forearms",
      "shoulders",
      "triceps",
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

// Live bug L2, 25 Nov 2026: Progress said Traps were not worked in November although the user
// logged face pulls, seated cable rows and lat pulldowns. The library (free-exercise-db) lists
// no traps for them, so they are added as secondary muscles by exercise name. Muscle lists as
// the library holds them, checked against dist/exercises.json on 25 Nov 2026.
describe("traps from pulling exercises (live bug L2)", () => {
  const facePull: LoggedSet = {
    exerciseName: "Face Pull",
    category: "strength",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: ["middle back"],
  };
  const seatedRow: LoggedSet = {
    exerciseName: "Seated Cable Rows",
    category: "strength",
    primaryMuscles: ["middle back"],
    secondaryMuscles: ["biceps", "lats", "shoulders"],
  };
  const pulldown: LoggedSet = {
    exerciseName: "Wide-Grip Lat Pulldown",
    category: "strength",
    primaryMuscles: ["lats"],
    secondaryMuscles: ["biceps", "middle back", "shoulders"],
  };

  it.each([
    ["face pull", facePull],
    ["seated cable row", seatedRow],
    ["lat pulldown", pulldown],
  ])("counts the %s toward traps, as a secondary muscle", (_name, set) => {
    const worked = musclesWorked([set]);
    expect(worked.secondary).toContain("traps");
    expect(worked.primary).not.toContain("traps");
  });

  it("keeps the lat pulldown's lats as primary", () => {
    expect(musclesWorked([pulldown]).primary).toEqual(["lats"]);
  });

  it("puts traps in the monthly shares, which is what Progress shows", () => {
    const shares = muscleShare([[facePull], [curl]]);
    expect(shares.find((share) => share.muscle === "traps")).toMatchObject({
      workouts: 1,
    });
  });

  it("leaves traps primary when the library already says so", () => {
    const shrug: LoggedSet = {
      exerciseName: "Barbell Shrug",
      category: "strength",
      primaryMuscles: ["traps"],
      secondaryMuscles: [],
    };
    expect(musclesWorked([shrug])).toEqual({
      primary: ["traps"],
      secondary: [],
    });
  });

  it("does not add traps to a stretch or an exercise without that name", () => {
    expect(
      musclesWorked([{ ...facePull, category: "stretching" }]).secondary,
    ).toEqual([]);
    expect(musclesWorked([{ ...curl, exerciseName: "Barbell Curl" }])).toEqual({
      primary: ["biceps"],
      secondary: ["forearms"],
    });
  });
});

describe("unmappedExercises", () => {
  it("lists strength exercises that name no muscle, once each, so they never count as nothing", () => {
    const blank = (exerciseName: string): LoggedSet => ({
      exerciseName,
      category: "strength",
      primaryMuscles: [],
      secondaryMuscles: [],
    });
    expect(
      unmappedExercises([
        blank("Odd Lift"),
        blank("Odd Lift"),
        blank("Another"),
        curl,
      ]),
    ).toEqual(["Another", "Odd Lift"]);
  });

  it("ignores stretches and cardio, which are not training muscles", () => {
    expect(
      unmappedExercises([
        {
          exerciseName: "Walk",
          category: "cardio",
          primaryMuscles: [],
          secondaryMuscles: [],
        },
      ]),
    ).toEqual([]);
  });
});
