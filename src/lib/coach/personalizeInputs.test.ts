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

// A gym profile gives inputs; the string answers have their own tests.
async function inputsFor(db: ReturnType<typeof database>) {
  const result = await loadPersonalizeInputs(db as never, "owner");
  if (typeof result === "string") throw new Error(`no inputs: ${result}`);
  return result;
}

describe("loadPersonalizeInputs", () => {
  it("builds the verifier profile from a gym profile", async () => {
    const db = database({
      trainingMode: "GYM",
      daysPerWeek: DAYS_PER_WEEK,
      equipment: ["barbell"],
      injuries: "Sore Quadriceps after running",
    });
    const result = await inputsFor(db);
    expect(db.profile.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "owner" } }),
    );
    expect(result.profile).toEqual({
      daysPerWeek: DAYS_PER_WEEK,
      equipment: ["barbell"],
      avoidMuscles: ["quadriceps"],
      reportedJoints: [],
    });
    expect(result.library).toEqual(library);
  });

  // Shubham's review of #127: generatePlan writes strength plans only, but the verifier
  // accepts any library id, so a cardio or stretching reply could pass and be saved.
  it("offers the coach strength exercises only, however the category is cased", async () => {
    const db = database({
      trainingMode: "GYM",
      daysPerWeek: DAYS_PER_WEEK,
      equipment: ["barbell"],
      injuries: null,
    });
    db.exercise.findMany.mockResolvedValue([
      ...library,
      { ...library[0], id: "Stair_Climb", category: "cardio" },
      { ...library[0], id: "Hamstring_Stretch", category: "stretching" },
      { ...library[0], id: "Upper_Row", category: "Strength" },
    ]);
    const result = await inputsFor(db);
    expect(result.library.map((exercise) => exercise.id)).toEqual([
      "Barbell_Squat",
      "Pushups",
      "Upper_Row",
    ]);
  });

  it("still takes avoided muscles from the whole library, not only the strength exercises", async () => {
    const db = database({
      trainingMode: "GYM",
      daysPerWeek: DAYS_PER_WEEK,
      equipment: ["barbell"],
      injuries: "tight neck",
    });
    db.exercise.findMany.mockResolvedValue([
      ...library,
      {
        ...library[0],
        id: "Neck_Stretch",
        category: "stretching",
        primaryMuscles: ["neck"],
      },
    ]);
    const result = await inputsFor(db);
    expect(result.profile.avoidMuscles).toEqual(["neck"]);
  });

  // The live prompt lists names (buildPlanPrompt uses name ?? id), so the loader must
  // select them, or the model sees raw ids.
  it("selects the exercise name, which the prompt lists", async () => {
    const db = database({
      trainingMode: "GYM",
      daysPerWeek: DAYS_PER_WEEK,
      equipment: [],
      injuries: null,
    });
    await loadPersonalizeInputs(db as never, "owner");
    expect(db.exercise.findMany).toHaveBeenCalledWith({
      select: expect.objectContaining({ id: true, name: true, category: true }),
    });
  });

  // Main's quiz (src/app/onboarding/actions.ts) passes the joints the user reported as
  // painful, and verifyPlan rejects a slot that loads one or has no joint mapping.
  // Personalize must pass the same joints, or a coach plan could load an injured joint.
  describe("reported joint pain (joint-aware verifier on main)", () => {
    const mapped = [
      { ...library[0], id: "Barbell_Squat" }, // loads the knee
      { ...library[0], id: "Pullups" }, // shoulder, elbow, wrist
      { ...library[0], id: "Mystery_Move" }, // no joint mapping
    ];

    it("passes the joints parsed from the injury text, as the quiz does", async () => {
      const db = database({
        trainingMode: "GYM",
        daysPerWeek: DAYS_PER_WEEK,
        equipment: ["barbell"],
        injuries: "my knee hurts on stairs",
      });
      db.exercise.findMany.mockResolvedValue(mapped);
      const result = await inputsFor(db);
      expect(result.profile.reportedJoints).toEqual(["knee"]);
    });

    it("offers only exercises the verifier would accept: mapped and not loading a reported joint", async () => {
      const db = database({
        trainingMode: "GYM",
        daysPerWeek: DAYS_PER_WEEK,
        equipment: ["barbell"],
        injuries: "my knee hurts on stairs",
      });
      db.exercise.findMany.mockResolvedValue(mapped);
      const result = await inputsFor(db);
      expect(result.library.map((exercise) => exercise.id)).toEqual([
        "Pullups",
      ]);
    });

    it("keeps the whole strength library, mapped or not, when no joint is reported", async () => {
      const db = database({
        trainingMode: "GYM",
        daysPerWeek: DAYS_PER_WEEK,
        equipment: ["barbell"],
        injuries: "I am sore from last week",
      });
      db.exercise.findMany.mockResolvedValue(mapped);
      const result = await inputsFor(db);
      expect(result.profile.reportedJoints).toEqual([]);
      expect(result.library.map((exercise) => exercise.id)).toEqual([
        "Barbell_Squat",
        "Pullups",
        "Mystery_Move",
      ]);
    });
  });

  it("says no-profile without a profile", async () => {
    const db = database(null);
    expect(await loadPersonalizeInputs(db as never, "owner")).toBe(
      "no-profile",
    );
    expect(db.exercise.findMany).not.toHaveBeenCalled();
  });

  it.each(["RUNNING", "BOTH"])(
    "says not-gym for a %s profile, without reading the library",
    async (trainingMode) => {
      const db = database({
        trainingMode,
        daysPerWeek: DAYS_PER_WEEK,
        equipment: [],
        injuries: null,
      });
      expect(await loadPersonalizeInputs(db as never, "owner")).toBe("not-gym");
      expect(db.exercise.findMany).not.toHaveBeenCalled();
    },
  );
});
