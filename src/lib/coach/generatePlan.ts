// Plan generation: ask the model, verify, retry once with the problems listed, then
// fall back to the rule-based plan. The model call is passed in, so this logic is
// tested without a network or an API key, and the provider (Groq or Gemini, issue #7)
// can change without touching it.
import { buildDefaultPlan } from "./defaultPlan";
import type { PlanInput } from "./schema";
import {
  fitsProfile,
  verifyPlan,
  type LibraryExercise,
  type VerifyProfile,
} from "./verify";

// What the coach needs from a model: given a prompt, return parsed JSON (or throw).
export type PlanModel = (prompt: string) => Promise<unknown>;

export type GeneratedPlan = {
  plan: PlanInput;
  source: "COACH" | "DEFAULT"; // matches the PlanSource enum in prisma/schema.prisma
  attempts: number;
};

const MAX_ATTEMPTS = 2;

// Every exercise the user can do goes into the prompt; none is dropped for length.
// Names grouped by muscle and category cost about 40% fewer tokens than one "id
// (muscles)" line each: the full gym list (694 exercises) is about 4,700 tokens,
// which leaves room for the reply inside Groq's free-tier 8,000 tokens a minute
// (docs/COACH_EVAL.md, round 2).
export function buildPlanPrompt(
  profile: VerifyProfile,
  library: LibraryExercise[],
  problems: string[] = [],
): string {
  const groups = new Map<string, string[]>();
  for (const e of library) {
    const key = `${e.primaryMuscles[0] ?? "other"}${e.category ? ` (${e.category})` : ""}`;
    groups.set(key, [...(groups.get(key) ?? []), e.name ?? e.id]);
  }
  const options = [...groups]
    .map(([group, names]) => `${group}: ${names.join("; ")}`)
    .join("\n");
  const retry =
    problems.length > 0
      ? `\nYour last plan was rejected for these reasons. Fix every one:\n- ${problems.join("\n- ")}\n`
      : "";
  return [
    `Build a ${profile.daysPerWeek}-day weekly strength plan as JSON: {"name", "days": [{"name", "exercises": [{"exercise", "sets", "reps", "restSeconds"}]}]}.`,
    `"exercise" must be an exact name from this list, which is grouped as "muscle (category): name; name":\n${options}`,
    `2 to 8 exercises a day, no exercise twice on a day, sets 1 to 6, reps 1 to 30, rest 30 to 300 seconds.`,
    retry,
  ].join("\n\n");
}

// The model answers with exercise names; the plan is stored and verified by id. A
// name not in the library is kept as written, so the verifier reports it.
export function namesToIds(raw: unknown, library: LibraryExercise[]): unknown {
  const idByName = new Map(library.map((e) => [e.name ?? e.id, e.id]));
  if (typeof raw !== "object" || raw === null) return raw;
  const plan = raw as { days?: unknown };
  if (!Array.isArray(plan.days)) return raw;
  return {
    ...plan,
    days: plan.days.map((day) => {
      if (typeof day !== "object" || day === null) return day;
      const d = day as { exercises?: unknown };
      if (!Array.isArray(d.exercises)) return day;
      return {
        ...d,
        exercises: d.exercises.map((slot) => {
          if (typeof slot !== "object" || slot === null) return slot;
          const { exercise, ...rest } = slot as Record<string, unknown>;
          if (typeof exercise !== "string") return slot;
          return { exerciseId: idByName.get(exercise) ?? exercise, ...rest };
        }),
      };
    }),
  };
}

export async function generatePlan(
  model: PlanModel,
  profile: VerifyProfile,
  library: LibraryExercise[],
): Promise<GeneratedPlan> {
  const usable = library.filter((e) => fitsProfile(e, profile));
  const byId = new Map(library.map((e) => [e.id, e]));
  let problems: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const raw = await model(buildPlanPrompt(profile, usable, problems));
      const result = verifyPlan(namesToIds(raw, usable), profile, byId);
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
