// Tests for the "Why this plan" rows (#66): one per source state, plus the edges.
import { describe, expect, it } from "vitest";
import { whyThisPlan, type WhyRecord } from "./whyThisPlan";

const SECOND_ATTEMPT = 2;
const STRENGTH_CHECK_COUNT = 6;
const served = { provider: "groq", model: "llama-3.3-70b-versatile" };

function record(overrides: Partial<WhyRecord>): WhyRecord {
  return {
    attempt: 1,
    outcome: "ok",
    providerEvents: [],
    ...overrides,
  };
}

const rejected = record({
  attempt: 1,
  outcome: "rejected",
  ...served,
  problems: [
    "day 2 (Push), Barbell Squat: needs barbell, which the user does not have",
  ],
});

describe("whyThisPlan", () => {
  it("lists source and checks, and no regeneration, for a model plan that passed first try", () => {
    const rows = whyThisPlan({
      source: "COACH",
      records: [record({ outcome: "ok", ...served })],
    });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks"]);
    expect(rows[0]?.summary).toBe(
      "Written by the coach (groq, llama-3.3-70b-versatile).",
    );
    expect(rows[1]?.details).toEqual([
      "Every exercise is in our exercise library.",
      "Equipment matches what you have.",
      "No exercise works a muscle you reported trouble with.",
      "No exercise repeats on the same day.",
      "The number of training days matches your answer.",
      "Sets, reps and rest are within the allowed ranges.",
    ]);
  });

  it("adds a regeneration row naming what the first reply got wrong when the model passed on its second try", () => {
    const rows = whyThisPlan({
      source: "COACH",
      records: [
        rejected,
        record({ attempt: SECOND_ATTEMPT, outcome: "retried", ...served }),
      ],
    });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks", "regeneration"]);
    expect(rows[2]?.summary).toBe(
      "The first reply did not pass the checks, so the coach was asked again. The second reply passed.",
    );
    expect(rows[2]?.details).toEqual([
      "day 2 (Push), Barbell Squat: needs barbell, which the user does not have",
    ]);
  });

  it("says the plan was built by rules, and why, when the coach's replies both failed", () => {
    const rows = whyThisPlan({
      source: "DEFAULT",
      records: [
        rejected,
        record({
          attempt: SECOND_ATTEMPT,
          outcome: "error",
          error: "timeout",
        }),
        record({
          attempt: SECOND_ATTEMPT,
          outcome: "rule_based",
          problems: ["the reply was not valid JSON for the plan shape"],
        }),
      ],
    });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks", "regeneration"]);
    expect(rows[0]?.summary).toBe(
      "Built by fixed rules from your answers, not written by the coach.",
    );
    expect(rows[2]?.summary).toBe(
      "The coach's replies did not pass the checks, so you got the rule-based plan.",
    );
    expect(rows[2]?.details).toEqual([
      "the reply was not valid JSON for the plan shape",
    ]);
  });

  it("does not claim a first-try pass or a provider when no log record exists for the plan", () => {
    const rows = whyThisPlan({ source: "COACH", records: [] });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks"]);
    expect(rows[0]?.summary).toBe("Written by the coach.");
  });

  it("shows at most three problems and counts the rest", () => {
    const many = record({
      attempt: 1,
      outcome: "rejected",
      problems: ["a", "b", "c", "d", "e"],
    });

    const rows = whyThisPlan({
      source: "COACH",
      records: [
        many,
        record({ attempt: SECOND_ATTEMPT, outcome: "retried", ...served }),
      ],
    });

    expect(rows[2]?.details).toEqual(["a", "b", "c", "and 2 more."]);
  });

  it("adds the running cap check only when the plan includes running", () => {
    const withRun = whyThisPlan({
      source: "COACH",
      records: [record({ outcome: "ok", ...served })],
      includesRunning: true,
    });
    const without = whyThisPlan({
      source: "COACH",
      records: [record({ outcome: "ok", ...served })],
    });

    expect(withRun[1]?.details.at(-1)).toBe(
      "Weekly running distance stays within the cap: 10% more than last week's logged distance.",
    );
    expect(without[1]?.details).toHaveLength(STRENGTH_CHECK_COUNT);
  });
});
