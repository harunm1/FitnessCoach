// Tests for the "Why this plan" rows (#66): one per source state, plus the edges.
import { describe, expect, it } from "vitest";
import { whyThisPlan, type WhyRecord } from "./whyThisPlan";

const SECOND_ATTEMPT = 2;
const STRENGTH_CHECK_COUNT = 6;
const served = { provider: "groq", model: "llama-3.3-70b-versatile" };

function record(overrides: Partial<WhyRecord>): WhyRecord {
  return { attempt: 1, outcome: "ok", ...overrides };
}

const rejected = record({
  attempt: 1,
  outcome: "rejected",
  ...served,
  problems: [
    "day 2 (Push), Barbell Squat: needs barbell, which the user does not have",
  ],
});

const failedCall = record({ attempt: 1, outcome: "error", error: "timeout" });

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
    expect(rows[1]?.summary).toBe("This plan meets these rules.");
    expect(rows[1]?.details).toEqual([
      "Every exercise is in our exercise library.",
      "Equipment matches what you have.",
      "No exercise works a muscle you reported trouble with.",
      "No exercise repeats on the same day.",
      "The number of training days matches your answer.",
      "Sets, reps and rest are within the allowed ranges.",
    ]);
  });

  it("names what the first reply got wrong, in second person, when the model passed on its second try", () => {
    const rows = whyThisPlan({
      source: "COACH",
      records: [
        rejected,
        record({ attempt: SECOND_ATTEMPT, outcome: "retried", ...served }),
      ],
    });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks", "regeneration"]);
    expect(rows[2]?.summary).toBe(
      "The first reply did not pass the checks, so the coach was asked again. The reply on attempt 2 passed.",
    );
    expect(rows[2]?.details).toEqual([
      "day 2 (Push), Barbell Squat: needs barbell, which you do not have",
    ]);
  });

  it("says the first request failed, with no reasons, when a failed call was followed by a pass", () => {
    const rows = whyThisPlan({
      source: "COACH",
      records: [
        failedCall,
        record({ attempt: SECOND_ATTEMPT, outcome: "retried", ...served }),
      ],
    });

    expect(rows[2]?.summary).toBe(
      "The first request to the coach failed, so it was asked again. The reply on attempt 2 passed.",
    );
    expect(rows[2]?.details).toEqual([]);
  });

  it("still reports a second try when the failed attempt's record is missing", () => {
    const rows = whyThisPlan({
      source: "COACH",
      records: [
        record({ attempt: SECOND_ATTEMPT, outcome: "retried", ...served }),
      ],
    });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks", "regeneration"]);
    expect(rows[2]?.summary).toBe(
      "The coach needed more than one try. The reply on attempt 2 passed.",
    );
  });

  it("does not report a regeneration for a provider retry inside the first attempt", () => {
    const rows = whyThisPlan({
      source: "COACH",
      records: [record({ attempt: 1, outcome: "retried", ...served })],
    });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks"]);
  });

  it("says the plan was built by rules, and lists the last rejection, when the coach never passed", () => {
    const rows = whyThisPlan({
      source: "DEFAULT",
      records: [
        rejected,
        record({
          attempt: SECOND_ATTEMPT,
          outcome: "rejected",
          problems: ["day 1 (Pull): appears twice on the same day"],
        }),
        record({
          attempt: SECOND_ATTEMPT,
          outcome: "rule_based",
          problems: ["day 1 (Pull): appears twice on the same day"],
        }),
      ],
    });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks", "regeneration"]);
    expect(rows[0]?.summary).toBe(
      "Built by fixed rules from your answers, not written by the coach.",
    );
    expect(rows[2]?.summary).toBe(
      "The coach did not give an answer that passed the checks, so you got the rule-based plan.",
    );
    expect(rows[2]?.details).toEqual([
      "day 1 (Pull): appears twice on the same day",
    ]);
  });

  it("does not blame the answer's format when both calls failed", () => {
    const rows = whyThisPlan({
      source: "DEFAULT",
      records: [
        failedCall,
        record({ attempt: SECOND_ATTEMPT, outcome: "error", error: "429" }),
        record({
          attempt: SECOND_ATTEMPT,
          outcome: "rule_based",
          problems: ["the reply was not valid JSON for the plan shape"],
        }),
      ],
    });

    expect(rows[2]?.summary).toBe(
      "The coach did not give an answer that passed the checks, so you got the rule-based plan.",
    );
    expect(rows[2]?.details).toEqual([]);
  });

  it("keeps the earlier rejection's reasons when a rejection was followed by a failed call", () => {
    const rows = whyThisPlan({
      source: "DEFAULT",
      records: [
        rejected,
        record({ attempt: SECOND_ATTEMPT, outcome: "error", error: "timeout" }),
        record({
          attempt: SECOND_ATTEMPT,
          outcome: "rule_based",
          problems: ["the reply was not valid JSON for the plan shape"],
        }),
      ],
    });

    expect(rows[2]?.details).toEqual([
      "day 2 (Push), Barbell Squat: needs barbell, which you do not have",
    ]);
  });

  it("shows source and checks only for a rule-based plan saved without any coach call", () => {
    const rows = whyThisPlan({ source: "DEFAULT", records: [] });

    expect(rows.map((r) => r.id)).toEqual(["source", "checks"]);
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

  it("states the running cap in words that are true with and without logged runs", () => {
    const rows = whyThisPlan({
      source: "COACH",
      records: [record({ outcome: "ok", ...served })],
      includesRunning: true,
    });

    expect(rows[1]?.details.at(-1)).toBe(
      "Weekly running distance stays within a safe cap: at most 10% more than last week's logged distance, or a starting amount for your activity level if you have not logged runs yet.",
    );
  });

  it("leaves out the running line when the plan has no running", () => {
    const rows = whyThisPlan({
      source: "COACH",
      records: [record({ outcome: "ok", ...served })],
    });

    expect(rows[1]?.details).toHaveLength(STRENGTH_CHECK_COUNT);
  });

  it("drops the training-days line when running is included, for a rule-based plan too", () => {
    const rows = whyThisPlan({
      source: "DEFAULT",
      records: [],
      includesRunning: true,
    });

    expect(rows[1]?.details).not.toContain(
      "The number of training days matches your answer.",
    );
    expect(rows[1]?.details).toHaveLength(STRENGTH_CHECK_COUNT);
  });
});
