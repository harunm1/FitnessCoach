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

describe("the full exercise list in the prompt", () => {
  const named: LibraryExercise[] = [
    {
      id: "Barbell_Bench",
      name: "Barbell Bench",
      category: "strength",
      equipment: "barbell",
      primaryMuscles: ["chest"],
      secondaryMuscles: ["triceps"],
    },
    {
      id: "Pushups",
      name: "Pushups",
      category: "strength",
      equipment: "body only",
      primaryMuscles: ["chest"],
      secondaryMuscles: [],
    },
    {
      id: "Cable_Row",
      name: "Cable Row",
      category: "strength",
      equipment: "cable",
      primaryMuscles: ["middle back"],
      secondaryMuscles: [],
    },
    {
      id: "Good_Morning",
      name: "Good Morning",
      category: "strength",
      equipment: "barbell",
      primaryMuscles: ["hamstrings"],
      secondaryMuscles: ["lower back"],
    },
  ];
  const user: VerifyProfile = {
    daysPerWeek: 1,
    equipment: ["barbell"],
    avoidMuscles: ["lower back"],
  };

  it("offers every exercise the user can do, grouped by muscle, and nothing else", async () => {
    const model = vi.fn<PlanModel>().mockRejectedValue(new Error("down"));
    await generatePlan(model, user, named);
    const prompt = model.mock.calls[0][0];
    expect(prompt).toContain("chest (strength): Barbell Bench; Pushups");
    expect(prompt).not.toContain("Cable Row"); // no cable machine
    expect(prompt).not.toContain("Good Morning"); // works the lower back
  });

  it("maps the names the model returns back to ids before verifying", async () => {
    const model = vi.fn<PlanModel>().mockResolvedValue({
      name: "P",
      days: [
        {
          name: "Full",
          exercises: [
            { exercise: "Barbell Bench", sets: 3, reps: 8, restSeconds: 90 },
            { exercise: "Pushups", sets: 3, reps: 12, restSeconds: 60 },
          ],
        },
      ],
    });
    const result = await generatePlan(model, user, named);
    expect(result.source).toBe("COACH");
    expect(result.plan.days[0].exercises.map((e) => e.exerciseId)).toEqual([
      "Barbell_Bench",
      "Pushups",
    ]);
  });

  it("accepts a near miss of a real name (case, punctuation, the, plural, group label)", async () => {
    const model = vi.fn<PlanModel>().mockResolvedValue({
      name: "P",
      days: [
        {
          name: "Full",
          exercises: [
            { exercise: "barbell bench", sets: 3, reps: 8, restSeconds: 90 },
            {
              exercise: "chest (strength): the pushup.",
              sets: 3,
              reps: 12,
              restSeconds: 60,
            },
          ],
        },
      ],
    });
    const result = await generatePlan(model, user, named);
    expect(result.source).toBe("COACH");
    expect(result.plan.days[0].exercises.map((e) => e.exerciseId)).toEqual([
      "Barbell_Bench",
      "Pushups",
    ]);
  });

  it("names an invented exercise in the retry prompt", async () => {
    const model = vi.fn<PlanModel>().mockResolvedValue({
      name: "P",
      days: [
        {
          name: "Full",
          exercises: [
            { exercise: "Barbell Bench", sets: 3, reps: 8, restSeconds: 90 },
            {
              exercise: "Chest Fly Machine",
              sets: 3,
              reps: 12,
              restSeconds: 60,
            },
          ],
        },
      ],
    });
    await generatePlan(model, user, named);
    expect(model.mock.calls[1][0]).toMatch(
      /Chest Fly Machine: not in the exercise library/,
    );
  });
});
