// The quiz's first plan (D38): the closest template fitted by rule replaces the starter
// plan, when the template's days match the quiz and every slot fits; otherwise the
// starter plan stays as the last resort, so nobody leaves the quiz without a plan.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { CategorisedExercise } from "@/lib/coach/verify";
import { checkProgram } from "./guardrails";
import { quizProgram } from "./quizProgram";

const library: CategorisedExercise[] = JSON.parse(
  readFileSync("eval/fixtures-library.json", "utf8"),
);
const byId = new Map(library.map((e) => [e.id, e]));
const answers = {
  goal: "STRENGTH",
  level: "BEGINNER",
  daysPerWeek: 3,
} as const;
const gym = {
  daysPerWeek: 3,
  equipment: ["barbell", "dumbbell"],
  avoidMuscles: [],
  level: "BEGINNER" as const,
};

describe("quizProgram", () => {
  it("uses the closest template when its days match and it fits", () => {
    const result = quizProgram(answers, gym, library);
    expect(result.kind).toBe("template");
    if (result.kind !== "template") return;
    expect(result.template.id).toBe("full-body-3-beginner");
    expect(
      checkProgram(result.plan, {
        template: result.template,
        library: byId,
        profile: gym,
      }),
    ).toEqual([]);
  });

  it("fits the template by rule for a bodyweight-only user", () => {
    const bodyOnly = { ...gym, equipment: ["body only"] };
    const result = quizProgram(answers, bodyOnly, library);
    expect(result.kind).toBe("template");
    if (result.kind !== "template") return;
    const kit = result.plan.days.flatMap((d) =>
      d.exercises.map((s) => byId.get(s.exerciseId)!.equipment),
    );
    expect(kit.every((e) => e === null || e === "body only")).toBe(true);
  });

  it("keeps the starter plan when no template has the quiz's number of days", () => {
    expect(
      quizProgram(
        { ...answers, daysPerWeek: 5 },
        { ...gym, daysPerWeek: 5 },
        library,
      ),
    ).toEqual({ kind: "starter" });
  });

  it("keeps the starter plan when the template cannot be fitted", () => {
    // Every squat and lunge works the quadriceps, so no swap fits.
    const result = quizProgram(
      answers,
      { ...gym, avoidMuscles: ["quadriceps"] },
      library,
    );
    expect(result).toEqual({ kind: "starter" });
  });
});
