// The quiz's first plan (D38): the template closest to the answers, fitted to the
// user's kit by rule, with no model call, so the quiz answers at once. Used only when
// the template has the quiz's number of days and every slot fits; otherwise the caller
// keeps the starter plan (buildDefaultPlan) as the last resort.
import type { PlanInput } from "@/lib/coach/schema";
import type {
  CategorisedExercise,
  LibraryExercise,
  VerifyProfile,
} from "@/lib/coach/verify";
import { applyChanges } from "./changes";
import { closestTemplate } from "./closest";
import { fitChanges } from "./fit";
import { checkProgram } from "./guardrails";
import type { ProgramTemplate } from "./templateSchema";

export type QuizProgram =
  | { kind: "template"; template: ProgramTemplate; plan: PlanInput }
  | { kind: "starter" };

export function quizProgram(
  answers: Parameters<typeof closestTemplate>[0],
  profile: VerifyProfile,
  library: CategorisedExercise[],
): QuizProgram {
  const template = closestTemplate(answers);
  if (template.daysPerWeek !== answers.daysPerWeek) return { kind: "starter" };
  const changes = fitChanges(template, profile, library);
  const { plan, problems } = applyChanges(
    template,
    changes,
    new Set(changes.map((c) => c.id)),
  );
  const byId = new Map<string, LibraryExercise>(library.map((e) => [e.id, e]));
  const all = [
    ...problems,
    ...checkProgram(plan, { template, library: byId, profile }),
  ];
  return all.length === 0
    ? { kind: "template", template, plan }
    : { kind: "starter" };
}
