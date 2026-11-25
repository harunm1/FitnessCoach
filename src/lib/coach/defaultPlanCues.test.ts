// The starter plan prefers an exercise with curated cues when several fit a slot (#103, D26).
import { describe, expect, it } from "vitest";
import { buildDefaultPlan } from "./defaultPlan";
import { verifyPlan } from "./verify";
import type { CategorisedExercise, VerifyProfile } from "./verify";

type Level = "BEGINNER" | "INTERMEDIATE" | "EXPERT";

function move(
  id: string,
  equipment: string,
  primary: string,
  options: { cued?: boolean; level?: Level } = {},
): CategorisedExercise {
  return {
    id,
    category: "strength",
    equipment,
    primaryMuscles: [primary],
    secondaryMuscles: [],
    level: options.level ?? "BEGINNER",
    cues: options.cued ? ["Brace your core", "Keep the bar close"] : [],
  };
}

// Each muscle of the Push, Pull and Legs split has an uncued body-only move first in the
// library, as the dataset's order gives, and a cued one after it.
const MUSCLES = [
  "chest",
  "shoulders",
  "triceps",
  "middle back",
  "lats",
  "biceps",
  "quadriceps",
  "hamstrings",
  "glutes",
];
const bodyOnly = MUSCLES.flatMap((m) => [
  move(`plain-${m}`, "body only", m),
  move(`cued-${m}`, "body only", m, { cued: true }),
]);

const noEquipment: VerifyProfile = {
  daysPerWeek: 3,
  equipment: [],
  avoidMuscles: [],
  level: "BEGINNER",
};

const pickedIds = (profile: VerifyProfile, library: CategorisedExercise[]) =>
  buildDefaultPlan(profile, library).days.flatMap((d) =>
    d.exercises.map((e) => e.exerciseId),
  );

describe("the starter plan prefers exercises with cues (#103)", () => {
  it("picks the cued move for a user with no equipment, whatever the library order", () => {
    const ids = pickedIds(noEquipment, bodyOnly);
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.every((id) => id.startsWith("cued-"))).toBe(true);
  });

  it("picks the cued move when the user gives no level either", () => {
    const ids = pickedIds({ ...noEquipment, level: undefined }, bodyOnly);
    expect(ids.every((id) => id.startsWith("cued-"))).toBe(true);
  });

  it("keeps the library order when no exercise has cues", () => {
    const uncued = bodyOnly.filter((e) => e.id.startsWith("plain-"));
    const ids = pickedIds(noEquipment, uncued);
    expect(ids.every((id) => id.startsWith("plain-"))).toBe(true);
  });

  it("counts an empty cue list, and a row with no cue field, as no cues", () => {
    const noField = { ...move("no-field", "body only", "chest") };
    delete noField.cues;
    const lib = [
      noField,
      move("empty", "body only", "chest"),
      move("has", "body only", "chest", { cued: true }),
      move("legs", "body only", "quadriceps"),
    ];
    const picked = pickedIds(
      { ...noEquipment, daysPerWeek: 1, level: undefined },
      lib,
    );
    expect(picked).toContain("has");
    expect(picked).not.toContain("no-field");
    expect(picked).not.toContain("empty");
  });

  it("never lets cues override the user's level", () => {
    const lib = [
      move("easy", "body only", "chest"),
      move("hard-cued", "body only", "chest", {
        cued: true,
        level: "EXPERT",
      }),
      move("legs", "body only", "quadriceps"),
    ];
    const picked = pickedIds({ ...noEquipment, daysPerWeek: 1 }, lib);
    expect(picked).toContain("easy");
    expect(picked).not.toContain("hard-cued");
  });

  it("never gives a no-equipment beginner a move above their level, even with no easier one for the muscle (#103)", () => {
    const lib = [
      ...bodyOnly.filter((e) => e.primaryMuscles[0] !== "shoulders"),
      move("handstand-pushup", "body only", "shoulders", {
        cued: true,
        level: "EXPERT",
      }),
    ];
    const picked = pickedIds(noEquipment, lib);
    expect(picked).not.toContain("handstand-pushup");
  });

  it("keeps a beginner's rows that have no level or an unknown one", () => {
    const unknown = bodyOnly.map((e, i) => ({
      ...e,
      level: i % 2 ? "expert" : undefined,
    }));
    const picked = pickedIds(noEquipment, unknown);
    expect(picked.length).toBeGreaterThan(0);
  });

  it("keeps a barbell lift ahead of a cued dumbbell lift for an expert", () => {
    const lib = [
      move("barbell-bench", "barbell", "chest", { level: "INTERMEDIATE" }),
      move("cued-db-bench", "dumbbell", "chest", {
        cued: true,
        level: "INTERMEDIATE",
      }),
      move("barbell-squat", "barbell", "quadriceps", {
        level: "INTERMEDIATE",
      }),
    ];
    const picked = pickedIds(
      {
        daysPerWeek: 1,
        equipment: ["barbell", "dumbbell"],
        avoidMuscles: [],
        level: "EXPERT",
      },
      lib,
    );
    expect(picked).toContain("barbell-bench");
    expect(picked).not.toContain("cued-db-bench");
  });

  it("never lets cues put a bodyweight move before a barbell lift for an experienced user", () => {
    const lib = [
      move("barbell-bench", "barbell", "chest", { level: "INTERMEDIATE" }),
      move("cued-pushup", "body only", "chest", { cued: true }),
      move("barbell-squat", "barbell", "quadriceps", {
        level: "INTERMEDIATE",
      }),
    ];
    const picked = pickedIds(
      {
        daysPerWeek: 1,
        equipment: ["barbell"],
        avoidMuscles: [],
        level: "EXPERT",
      },
      lib,
    );
    expect(picked).toContain("barbell-bench");
    expect(picked).not.toContain("cued-pushup");
  });

  it("still passes the verifier for a no-equipment user at every day count", () => {
    const map = new Map(bodyOnly.map((e) => [e.id, e]));
    const verdicts = [1, 2, 3, 4, 5, 6, 7].map((daysPerWeek) => {
      const profile = { ...noEquipment, daysPerWeek };
      return verifyPlan(buildDefaultPlan(profile, bodyOnly), profile, map).ok;
    });
    expect(verdicts.every(Boolean)).toBe(true);
  });
});
