// The coach adapts a template to one user (D38). Rules fit the template to the user's
// kit first; the model then proposes changes against it; the guardrails check the
// template with every change applied. Bad output of any kind, a provider failure or a
// timeout drops the model's changes, and the user gets the rule-fitted template at once
// with a plain note. The model is passed in, so this is tested without a network.
import type { PlanModel } from "@/lib/coach/generatePlan";
import type {
  CategorisedExercise,
  LibraryExercise,
  VerifyProfile,
} from "@/lib/coach/verify";
import { applyChanges, type Change } from "./changes";
import { parseCoachChanges } from "./parseChanges";
import { fitChanges } from "./fit";
import { checkProgram, MAX_WEEKLY_SETS_PER_MUSCLE } from "./guardrails";
import { MIN_EXERCISES_PER_DAY, type ProgramTemplate } from "./templateSchema";

// Long enough for one Groq or Gemini call, short enough that a stalled provider does
// not keep the user on a spinner: they get the template instead.
export const ADAPT_TIMEOUT_MS = 10_000;

export const FALLBACK_NOTE =
  "The coach could not adapt this template just now, so here it is as written, fitted to your equipment. You can still change it later.";

// What the coach is told about the user beyond the verifier's profile.
export type AdaptAbout = {
  goal: string;
  injuries: string;
  units: "KG" | "LB";
};

export type Adaptation = {
  templateId: string;
  templateVersion: number;
  source: "COACH" | "TEMPLATE";
  changes: Change[]; // rule swaps first, then the coach's
  note?: string;
  // Problems the rule-fitted template still has (an exercise with no usable swap).
  // Not empty: the template does not fit this user and cannot be saved as is.
  problems: string[];
};

const label = (byId: Map<string, LibraryExercise>, id: string) =>
  byId.get(id)?.name ?? id;

export function buildAdaptPrompt(
  template: ProgramTemplate,
  profile: VerifyProfile,
  library: CategorisedExercise[],
  about: AdaptAbout,
  ruleChanges: Change[],
): string {
  const byId = new Map(library.map((e) => [e.id, e]));
  const all = new Set(ruleChanges.map((c) => c.id));
  const { plan } = applyChanges(template, ruleChanges, all);
  const days = plan.days
    .map(
      (day, d) =>
        `Day ${d + 1} (${day.name}, ${template.days[d].weekdays.join("/")}):\n` +
        day.exercises
          .map(
            (s, i) =>
              `${i + 1}. ${label(byId, s.exerciseId)}: ${s.sets} x ${s.reps}`,
          )
          .join("\n"),
    )
    .join("\n");
  const options = library
    .filter((e) => e.category?.toLowerCase() === "strength")
    .map((e) => e.name ?? e.id)
    .join("; ");
  return [
    `Adapt this ${template.daysPerWeek}-day template, "${template.name}", to one user. Do not write a new plan: return only the changes it needs, as JSON {"changes": [{"op", "day", "slot", ...}]}.`,
    days,
    `The user: goal ${about.goal}, level ${profile.level ?? "unknown"}, wants ${profile.daysPerWeek} days a week, equipment ${profile.equipment.join(", ") || "none"}, injuries or pain: ${about.injuries || "none"}, weights in ${about.units}.`,
    `Changes: {"op": "swap", "day", "slot", "exercise": an exact name from the list below, "reason"}, {"op": "sets", "day", "slot", "sets", "reason"}, {"op": "reps", "day", "slot", "reps", "reason"}, {"op": "remove", "day", "slot", "reason"}. Day and slot are the numbers above. Every change needs a one-sentence reason the user will read.`,
    `Limits: sets 1 to 6, reps ${template.repBand.min} to ${template.repBand.max}, at least ${MIN_EXERCISES_PER_DAY} exercises a day, at most ${MAX_WEEKLY_SETS_PER_MUSCLE} sets a week per muscle, only equipment the user has. If the template already fits, return {"changes": []}.`,
    `Exercises you may swap in: ${options}`,
  ].join("\n\n");
}

// The model's answer, or a rejection when it takes longer than timeoutMs.
function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`no answer in ${timeoutMs} ms`)),
      timeoutMs,
    );
  });
  return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

export type AdaptOptions = {
  timeoutMs?: number;
  fallbackNote?: string; // the note shown when the template comes back as written
};

export async function adaptTemplate(
  model: PlanModel,
  template: ProgramTemplate,
  profile: VerifyProfile,
  library: CategorisedExercise[],
  about: AdaptAbout,
  {
    timeoutMs = ADAPT_TIMEOUT_MS,
    fallbackNote = FALLBACK_NOTE,
  }: AdaptOptions = {},
): Promise<Adaptation> {
  const byId = new Map<string, LibraryExercise>(library.map((e) => [e.id, e]));
  const ctx = { template, library: byId, profile };
  const rule = fitChanges(template, profile, library);
  const ids = (changes: Change[]) => new Set(changes.map((c) => c.id));
  const fitted = applyChanges(template, rule, ids(rule));
  const base = {
    templateId: template.id,
    templateVersion: template.version,
  };
  const problems = [...fitted.problems, ...checkProgram(fitted.plan, ctx)];
  const fallback: Adaptation = {
    ...base,
    source: "TEMPLATE",
    changes: rule,
    note: fallbackNote,
    problems,
  };
  // A template that does not fit even by rule is not worth a model call.
  if (problems.length > 0) return { ...fallback, note: undefined };

  let raw: unknown;
  try {
    raw = await withTimeout(
      model(buildAdaptPrompt(template, profile, library, about, rule)),
      timeoutMs,
    );
  } catch {
    return fallback; // provider error, timeout or unparseable reply
  }
  const parsed = parseCoachChanges(raw, library);
  if (!parsed.ok) return fallback;
  const changes = [...rule, ...parsed.changes];
  const adapted = applyChanges(template, changes, ids(changes));
  if (
    adapted.problems.length > 0 ||
    checkProgram(adapted.plan, ctx).length > 0
  ) {
    return fallback;
  }
  return { ...base, source: "COACH", changes, problems: [] };
}
