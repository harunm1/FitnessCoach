// Inputs for "Personalize with the coach" (#58): only a gym profile gets a coach plan,
// and avoided muscles come from the injury text the same way onboarding derives them.
import { describe, expect, it, vi } from "vitest";
import { loadPersonalizeInputs } from "./personalizeInputs";

const DAYS_PER_WEEK = 4;
const library = [
  {
    id: "Barbell_Squat",
    category: "strength",
    equipment: "barbell",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: ["glutes"],
  },
  {
    id: "Pushups",
    category: "strength",
    equipment: "body only",
    primaryMuscles: ["chest"],
    secondaryMuscles: ["triceps"],
  },
];

function database(profile: unknown) {
  return {
    profile: { findUnique: vi.fn().mockResolvedValue(profile) },
    exercise: { findMany: vi.fn().mockResolvedValue(library) },
  };
}

describe("loadPersonalizeInputs", () => {
  it("builds the verifier profile from a gym profile", async () => {
    const db = database({
      trainingMode: "GYM",
      daysPerWeek: DAYS_PER_WEEK,
      equipment: ["barbell"],
      injuries: "Sore Quadriceps after running",
    });
    const result = await loadPersonalizeInputs(db as never, "owner");
    expect(db.profile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "owner" } }),
    );
    expect(result?.profile).toEqual({
      daysPerWeek: DAYS_PER_WEEK,
      equipment: ["barbell"],
      avoidMuscles: ["quadriceps"],
    });
    expect(result?.library).toBe(library);
  });

  it("returns null without a profile", async () => {
    const db = database(null);
    expect(await loadPersonalizeInputs(db as never, "owner")).toBeNull();
    expect(db.exercise.findMany).not.toHaveBeenCalled();
  });

  it("returns null for a running or hybrid profile", async () => {
    const db = database({
      trainingMode: "BOTH",
      daysPerWeek: DAYS_PER_WEEK,
      equipment: [],
      injuries: null,
    });
    expect(await loadPersonalizeInputs(db as never, "owner")).toBeNull();
  });
});
