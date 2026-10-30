// Plan generation: ask the model, verify, retry once with the problems listed, then
// fall back to the rule-based plan. The model call is passed in, so this logic is
// tested without a network or an API key, and the provider (Groq or Gemini, issue #7)
// can change without touching it.
import { buildDefaultPlan } from "./defaultPlan";
import type { PlanInput } from "./schema";
import { verifyPlan, type LibraryExercise, type VerifyProfile } from "./verify";

// What the coach needs from a model: given a prompt, return parsed JSON (or throw).
export type PlanModel = (prompt: string) => Promise<unknown>;

export type GeneratedPlan = {
  plan: PlanInput;
  source: "COACH" | "DEFAULT"; // matches the PlanSource enum in prisma/schema.prisma
  attempts: number;
};

const MAX_ATTEMPTS = 2;

export function buildPlanPrompt(
  profile: VerifyProfile,
  library: LibraryExercise[],
  problems: string[] = [],
): string {
  // Only exercises the user can do are offered, so the model can't pick outside them.
  const options = library
    .map((e) => `${e.id} (${e.primaryMuscles.join(", ")})`)
    .join("\n");
  const retry =
    problems.length > 0
      ? `\nYour last plan was rejected for these reasons. Fix every one:\n- ${problems.join("\n- ")}\n`
      : "";
  return [
    `Build a ${profile.daysPerWeek}-day weekly strength plan as JSON: {"name", "days": [{"name", "exercises": [{"exerciseId", "sets", "reps", "restSeconds"}]}]}.`,
    `Use only these exercise ids:\n${options}`,
    `2 to 8 exercises a day, no exercise twice on a day, sets 1 to 6, reps 1 to 30, rest 30 to 300 seconds.`,
    retry,
  ].join("\n\n");
}

export async function generatePlan(
  model: PlanModel,
  profile: VerifyProfile,
  library: LibraryExercise[],
): Promise<GeneratedPlan> {
  const byId = new Map(library.map((e) => [e.id, e]));
  let problems: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await model(buildPlanPrompt(profile, library, problems));
      const result = verifyPlan(raw, profile, byId);
      if (result.ok)
        return { plan: result.plan, source: "COACH", attempts: attempt };
      problems = result.problems;
    } catch {
      // A failed call or unparseable reply counts as a failed attempt.
      problems = ["the reply was not valid JSON for the plan shape"];
    }
  }

  return {
    plan: buildDefaultPlan(profile, library),
    source: "DEFAULT",
    attempts: MAX_ATTEMPTS,
  };
}
