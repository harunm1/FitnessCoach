// The starter plan's warm-up slot (#145, D25 in docs/ARCHITECTURE.md): an intermediate or
// expert user's strength days open with one dynamic warm-up, picked by the day's lead muscle.
import { describe, expect, it } from "vitest";
import { buildDefaultPlan } from "./defaultPlan";
import { buildHybridWeek, type HybridProfile } from "./hybridWeek";
import { verifyPlan } from "./verify";
import type { CategorisedExercise, VerifyProfile } from "./verify";

function lift(
  id: string,
  equipment: string,
  primary: string,
): CategorisedExercise {
  return {
    id,
    category: "strength",
    equipment,
    primaryMuscles: [primary],
    secondaryMuscles: [],
    level: "INTERMEDIATE",
  };
}

// Stretches copied from free-exercise-db (dist/exercises.json, read 24 Nov), real ids and muscles.
function stretch(
  id: string,
  equipment: string | null,
  primary: string,
  secondary: string[],
): CategorisedExercise {
  return {
    id,
    category: "stretching",
    equipment,
    primaryMuscles: [primary],
    secondaryMuscles: secondary,
    level: "BEGINNER",
  };
}

const STRETCHES: CategorisedExercise[] = [
  stretch("Arm_Circles", null, "shoulders", ["traps"]),
  stretch("Shoulder_Circles", null, "shoulders", ["traps"]),
  stretch("Dynamic_Chest_Stretch", null, "chest", ["middle back"]),
  stretch("Dynamic_Back_Stretch", null, "lats", []),
  stretch("Standing_Hip_Circles", "body only", "abductors", ["adductors"]),
  stretch("Knee_Circles", "body only", "calves", ["hamstrings", "quadriceps"]),
];

const STRENGTH: CategorisedExercise[] = [
  lift("barbell-bench", "barbell", "chest"),
  lift("barbell-row", "barbell", "middle back"),
  lift("barbell-squat", "barbell", "quadriceps"),
  lift("barbell-rdl", "barbell", "hamstrings"),
  lift("hip-thrust", "barbell", "glutes"),
  lift("barbell-press", "barbell", "shoulders"),
  lift("barbell-curl", "barbell", "biceps"),
  lift("db-skull", "dumbbell", "triceps"),
  lift("cable-lat", "cable", "lats"),
  lift("calf-raise", "machine", "calves"),
  lift("cable-crunch", "cable", "abdominals"),
  lift("db-shrug", "dumbbell", "traps"),
  lift("wrist-curl", "dumbbell", "forearms"),
  lift("adductor-machine", "machine", "adductors"),
  lift("back-extension", "machine", "lower back"),
];

// The stretches come first, as in the dataset, so a plan that took the first fit would take them.
const library = [...STRETCHES, ...STRENGTH];

const gymProfile: VerifyProfile = {
  daysPerWeek: 3,
  equipment: ["body only", "dumbbell", "barbell", "cable", "machine"],
  avoidMuscles: [],
  level: "EXPERT",
};

const firstIds = (profile: VerifyProfile, lib = library) =>
  buildDefaultPlan(profile, lib).days.map((d) => d.exercises[0].exerciseId);

describe("the warm-up slot of a starter plan (#145)", () => {
  it("opens every day of an expert plan with a warm-up, then the big lift", () => {
    const plan = buildDefaultPlan(gymProfile, library);
    for (const day of plan.days) {
      expect(day.exercises[0]).toEqual({
        exerciseId: expect.any(String),
        sets: 1,
        reps: 10,
        restSeconds: 30,
        rpe: 6,
      });
    }
    // Push, Pull, Legs: lead lifts are the barbell bench, row and squat.
    expect(plan.days.map((d) => d.exercises[1].exerciseId)).toEqual([
      "barbell-bench",
      "barbell-row",
      "barbell-squat",
    ]);
  });

  it("picks the warm-up by the day's lead muscle", () => {
    expect(firstIds(gymProfile)).toEqual([
      "Dynamic_Chest_Stretch", // Push, chest first
      "Dynamic_Back_Stretch", // Pull, middle back first
      "Standing_Hip_Circles", // Legs, quadriceps first
    ]);
  });

  it("gives an intermediate user a warm-up too", () => {
    expect(firstIds({ ...gymProfile, level: "INTERMEDIATE" })[0]).toBe(
      "Dynamic_Chest_Stretch",
    );
  });

  it("leaves a beginner's plan, and a plan with no level, without one", () => {
    for (const level of ["BEGINNER", undefined] as const) {
      const ids = buildDefaultPlan(
        { ...gymProfile, level },
        library,
      ).days.flatMap((d) => d.exercises.map((e) => e.exerciseId));
      expect(ids.filter((id) => STRETCHES.some((s) => s.id === id))).toEqual(
        [],
      );
    }
  });

  it("adds nothing when the library holds no listed warm-up", () => {
    const withWarmup = buildDefaultPlan(gymProfile, library);
    const without = buildDefaultPlan(gymProfile, STRENGTH);
    expect(without.days.map((d) => d.exercises.length)).toEqual(
      withWarmup.days.map((d) => d.exercises.length - 1),
    );
    expect(without.days[0].exercises[0].exerciseId).toBe("barbell-bench");
  });

  it("skips a warm-up that touches a muscle the user reported trouble with", () => {
    // Middle back is the chest stretch's secondary muscle; the Push day is still led by the
    // bench, so the injury filter alone must drop Dynamic_Chest_Stretch for Arm_Circles.
    const ids = firstIds({ ...gymProfile, avoidMuscles: ["middle back"] });
    expect(ids[0]).toBe("Arm_Circles");
  });

  it("takes the next listed warm-up when the first needs kit the user lacks", () => {
    const circles = stretch("Standing_Hip_Circles", "cable", "abductors", []);
    const lib = [
      ...STRETCHES.filter((s) => s.id !== "Standing_Hip_Circles"),
      circles,
      ...STRENGTH,
    ];
    // No cable: Standing_Hip_Circles (here a cable move) does not fit, Knee_Circles does.
    const legsWarmup = firstIds(
      { ...gymProfile, equipment: ["barbell"] },
      lib,
    )[2];
    expect(legsWarmup).toBe("Knee_Circles");
  });

  it("stays within eight exercises a day, even for a one-day expert plan", () => {
    const plan = buildDefaultPlan({ ...gymProfile, daysPerWeek: 1 }, library);
    expect(plan.days[0].exercises.length).toBeLessThanOrEqual(8);
    expect(plan.days[0].exercises[0].sets).toBe(1);
  });

  it("passes the verifier for every level and day count", () => {
    const map = new Map(library.map((e) => [e.id, e]));
    for (const level of ["BEGINNER", "INTERMEDIATE", "EXPERT"] as const) {
      for (let daysPerWeek = 1; daysPerWeek <= 7; daysPerWeek++) {
        const profile = { ...gymProfile, level, daysPerWeek };
        const verdict = verifyPlan(
          buildDefaultPlan(profile, library),
          profile,
          map,
        );
        expect(verdict.ok, `${level} ${daysPerWeek} days`).toBe(true);
      }
    }
  });

  it("never lists the same exercise twice on a day", () => {
    const plan = buildDefaultPlan({ ...gymProfile, daysPerWeek: 5 }, library);
    for (const day of plan.days) {
      const ids = day.exercises.map((e) => e.exerciseId);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });
});

describe("cardio in a hybrid or running quiz week (#145)", () => {
  const hybrid: HybridProfile = {
    ...gymProfile,
    daysPerWeek: 3,
    goal: "FAT_LOSS",
    trainingMode: "BOTH",
    activityLevel: "ACTIVE",
    lastWeekKm: 0,
    easyPaceSecPerKm: 360,
  };

  it("keeps a run day next to the strength days, and the strength days open with a warm-up", () => {
    const week = buildHybridWeek(hybrid, library);
    expect(week.days.some((d) => d.kind === "RUN")).toBe(true);
    for (const day of week.days) {
      if (day.kind !== "STRENGTH") continue;
      expect(day.exercises[0].sets).toBe(1);
      expect(day.exercises[1].sets).toBe(4);
    }
  });

  it("gives a running-mode week run days, as before", () => {
    const week = buildHybridWeek(
      { ...hybrid, trainingMode: "RUNNING", daysPerWeek: 4 },
      library,
    );
    expect(week.days.filter((d) => d.kind === "RUN").length).toBeGreaterThan(0);
  });
});
