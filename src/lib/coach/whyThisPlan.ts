// Rows for the "Why this plan" panel (#66): which source made the plan, which rules it
// meets, and any regeneration. Built only from data the coach already returns: the saved
// plan's source and the plan's #49 log records. No model call, nothing recomputed.
import type { CoachRecord } from "./coachLog";

export type WhySource = "COACH" | "DEFAULT"; // the PlanSource enum in prisma/schema.prisma

export type WhyRecord = Pick<
  CoachRecord,
  "attempt" | "outcome" | "provider" | "model" | "problems"
> &
  Partial<Pick<CoachRecord, "error">>;

export type WhyRow = {
  id: "source" | "checks" | "regeneration";
  title: string;
  summary: string;
  details: string[];
};

export type WhyInput = {
  source: WhySource;
  records: WhyRecord[]; // the plan's log records, oldest first; empty when none were kept
  includesRunning?: boolean;
};

const MAX_PROBLEMS_SHOWN = 3;

// The rules in verifyPlan (verify.ts) and the plan schema. A model plan is checked against
// them before it is saved; the rule-based plan meets them by construction (it picks from
// the same fitsProfile filter and uses fixed sets, reps and rest). So the panel says the
// plan "meets" them, not that every saved plan was run through the verifier.
const DAYS_CHECK = "The number of training days matches your answer.";
const STRENGTH_CHECKS = [
  "Every exercise is in our exercise library.",
  "Equipment matches what you have.",
  "No exercise works a muscle you reported trouble with.",
  "No exercise repeats on the same day.",
  DAYS_CHECK,
  "Sets, reps and rest are within the allowed ranges.",
];

// weeklyCapKm (verifyRunning.ts): 10% over last week's logged distance, or a starting volume
// by activity level when nothing is logged. With running included, the strength part covers
// only some of the days asked for, so the days sentence is left out.
const RUNNING_CHECK =
  "Weekly running distance stays within a safe cap: at most 10% more than last week's logged distance, or a starting amount for your activity level if you have not logged runs yet.";

// Verifier problems are written for the model; these make the common ones read to the user.
const SECOND_PERSON: [string, string][] = [
  ["which the user does not have", "which you do not have"],
  ["which the user reported trouble with", "which you reported trouble with"],
  ["the user asked for", "you asked for"],
];

const PASSED = new Set<WhyRecord["outcome"]>(["ok", "retried", "switched"]);

function toSecondPerson(problem: string): string {
  return SECOND_PERSON.reduce(
    (text, [from, to]) => text.replaceAll(from, to),
    problem,
  );
}

function shown(problems: string[]): string[] {
  const rest = problems.length - MAX_PROBLEMS_SHOWN;
  const first = problems.slice(0, MAX_PROBLEMS_SHOWN).map(toSecondPerson);
  return rest > 0 ? [...first, `and ${rest} more.`] : first;
}

function sourceRow({ source, records }: WhyInput): WhyRow {
  if (source === "DEFAULT") {
    return {
      id: "source",
      title: "Source",
      summary:
        "Built by fixed rules from your answers, not written by the coach.",
      details: [],
    };
  }
  const served = records.findLast((r) => r.provider !== undefined);
  const who = served
    ? ` (${[served.provider, served.model].filter(Boolean).join(", ")})`
    : "";
  return {
    id: "source",
    title: "Source",
    summary: `Written by the coach${who}.`,
    details: [],
  };
}

function checksRow({ includesRunning }: WhyInput): WhyRow {
  return {
    id: "checks",
    title: "Rules this plan meets",
    summary: "This plan meets these rules.",
    details: includesRunning
      ? [...STRENGTH_CHECKS.filter((c) => c !== DAYS_CHECK), RUNNING_CHECK]
      : STRENGTH_CHECKS,
  };
}

function regenerationRow({ source, records }: WhyInput): WhyRow | null {
  const failed = records.filter(
    (r) => r.outcome === "rejected" || r.outcome === "error",
  );

  if (source === "DEFAULT") {
    if (failed.length === 0 && !records.some((r) => r.outcome === "rule_based"))
      return null;
    // The rule_based record's own problems can be a transport failure worded as bad JSON,
    // so reasons come only from a reply the verifier actually rejected.
    const lastRejected = records.findLast((r) => r.outcome === "rejected");
    return {
      id: "regeneration",
      title: "What happened first",
      summary:
        "The coach did not give an answer that passed the checks, so you got the rule-based plan.",
      details: shown(lastRejected?.problems ?? []),
    };
  }

  // A passing record on attempt 2 or later means a regeneration even if the failed
  // attempt's record was lost (a log write never breaks the request that it describes).
  const passed = records.findLast((r) => PASSED.has(r.outcome));
  const first = failed[0];
  if (!first && !(passed && passed.attempt > 1)) return null;
  const tail = passed ? ` The reply on attempt ${passed.attempt} passed.` : "";

  if (first?.outcome === "rejected") {
    return {
      id: "regeneration",
      title: "What happened first",
      summary: `The first reply did not pass the checks, so the coach was asked again.${tail}`,
      details: shown(first.problems ?? []),
    };
  }
  return {
    id: "regeneration",
    title: "What happened first",
    summary: first
      ? `The first request to the coach failed, so it was asked again.${tail}`
      : `The coach needed more than one try.${tail}`,
    details: [],
  };
}

export function whyThisPlan(input: WhyInput): WhyRow[] {
  return [sourceRow(input), checksRow(input), regenerationRow(input)].filter(
    (row): row is WhyRow => row !== null,
  );
}
