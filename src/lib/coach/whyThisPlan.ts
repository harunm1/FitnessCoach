// Rows for the "Why this plan" panel (#66): which source made the plan, which checks it
// passed, and any regeneration. Built only from data the coach already returns: the saved
// plan's source and the plan's #49 log records. No model call, nothing recomputed.
import type { CoachRecord } from "./coachLog";

export type WhySource = "COACH" | "DEFAULT"; // the PlanSource enum in prisma/schema.prisma

export type WhyRecord = Pick<
  CoachRecord,
  "attempt" | "outcome" | "provider" | "model" | "problems" | "providerEvents"
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

// What verifyPlan (src/lib/coach/verify.ts) and the plan schema check, in the order a
// reader would ask about them. Every saved plan passed these, model-written or rule-based.
const STRENGTH_CHECKS = [
  "Every exercise is in our exercise library.",
  "Equipment matches what you have.",
  "No exercise works a muscle you reported trouble with.",
  "No exercise repeats on the same day.",
  "The number of training days matches your answer.",
  "Sets, reps and rest are within the allowed ranges.",
];

// The running week's rule (verifyRunning.ts): at most 10% more than last week's logged distance.
const RUNNING_CHECK =
  "Weekly running distance stays within the cap: 10% more than last week's logged distance.";

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
    title: "Checks passed",
    summary: "This plan was checked before you saw it.",
    details: includesRunning
      ? [...STRENGTH_CHECKS, RUNNING_CHECK]
      : STRENGTH_CHECKS,
  };
}

function shown(problems: string[]): string[] {
  const rest = problems.length - MAX_PROBLEMS_SHOWN;
  return rest > 0
    ? [...problems.slice(0, MAX_PROBLEMS_SHOWN), `and ${rest} more.`]
    : problems;
}

// Problems of the first failed reply, or of the last when the coach never passed.
function regenerationRow({ source, records }: WhyInput): WhyRow | null {
  const failed = records.filter(
    (r) => r.outcome === "rejected" || r.outcome === "error",
  );
  if (source === "DEFAULT") {
    const last = records.findLast((r) => r.outcome === "rule_based");
    if (!last && failed.length === 0) return null;
    return {
      id: "regeneration",
      title: "What happened first",
      summary:
        "The coach's replies did not pass the checks, so you got the rule-based plan.",
      details: shown(last?.problems ?? failed.at(-1)?.problems ?? []),
    };
  }
  const first = failed[0];
  if (!first) return null;
  return {
    id: "regeneration",
    title: "What happened first",
    summary:
      "The first reply did not pass the checks, so the coach was asked again. The second reply passed.",
    details: shown(first.problems ?? []),
  };
}

export function whyThisPlan(input: WhyInput): WhyRow[] {
  return [sourceRow(input), checksRow(input), regenerationRow(input)].filter(
    (row): row is WhyRow => row !== null,
  );
}
