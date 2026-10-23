import { describe, expect, it, vi } from "vitest";
import { generatePlan, type PlanModel } from "./generatePlan";
import { verifyPlan, type LibraryExercise, type VerifyProfile } from "./verify";

const library: LibraryExercise[] = [
  {
    id: "bench",
    equipment: "barbell",
    primaryMuscles: ["chest"],
    secondaryMuscles: [],
  },
  {
    id: "pushup",
    equipment: "body only",
    primaryMuscles: ["chest"],
    secondaryMuscles: [],
  },
  {
    id: "squat",
    equipment: "barbell",
    primaryMuscles: ["quadriceps"],
    secondaryMuscles: [],
  },
  {
    id: "row",
    equipment: "barbell",
    primaryMuscles: ["middle back"],
    secondaryMuscles: [],
  },
  {
    id: "press",
    equipment: "barbell",
    primaryMuscles: ["shoulders"],
    secondaryMuscles: [],
  },
];
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
const good = {
  name: "P",
  days: [{ name: "Full", exercises: [slot("bench"), slot("squat")] }],
};
const bad = {
  name: "P",
  days: [{ name: "Full", exercises: [slot("bench"), slot("bench")] }],
};

describe("generatePlan", () => {
  it("returns the coach's plan when it passes the verifier first time", async () => {
    const model: PlanModel = vi.fn().mockResolvedValue(good);
    const result = await generatePlan(model, profile, library);
    expect(result).toMatchObject({ source: "COACH", attempts: 1 });
  });

  it("retries once with the problems in the prompt, then accepts a fixed plan", async () => {
    const model = vi
      .fn<PlanModel>()
      .mockResolvedValueOnce(bad)
      .mockResolvedValueOnce(good);
    const result = await generatePlan(model, profile, library);
    expect(result).toMatchObject({ source: "COACH", attempts: 2 });
    expect(model.mock.calls[1][0]).toMatch(/appears twice/);
  });

  it("falls back to a default plan that itself passes the verifier", async () => {
    const model: PlanModel = vi
      .fn()
      .mockRejectedValue(new Error("rate limited"));
    const result = await generatePlan(model, profile, library);
    expect(result.source).toBe("DEFAULT");
    const check = verifyPlan(
      result.plan,
      profile,
      new Map(library.map((e) => [e.id, e])),
    );
    expect(check.ok).toBe(true);
  });
});
