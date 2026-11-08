// The coach eval (#19) replayed in CI: the replies Groq and Gemini gave on 30 October
// (eval/results/2026-10-30-chain-round2.jsonl, docs/COACH_EVAL.md round 2) go back
// through generatePlan and the verifier with no network and no keys. If a change to
// name matching, the verifier or the retry logic would have turned one of those real
// replies into a different outcome, this fails. The live run stays manual
// (eval/coachEval.ts) because it needs keys and spends the free-tier quota.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVAL_PROFILES } from "./evalProfiles";
import { generatePlan, type PlanModel } from "./generatePlan";
import { verifyPlan, type CategorisedExercise } from "./verify";

type Row = {
  id: string;
  source: "COACH" | "DEFAULT";
  attempts: number;
  firstReplyPassed: boolean;
  calls: { reply?: unknown; error?: string }[];
};

const rows: Row[] = readFileSync(
  "eval/results/2026-10-30-chain-round2.jsonl",
  "utf8",
)
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));

// Only the exercises those replies name, copied from free-exercise-db with the same
// fields the app stores (eval/fixtures-library.json).
const library: CategorisedExercise[] = JSON.parse(
  readFileSync("eval/fixtures-library.json", "utf8"),
);
const byId = new Map(library.map((e) => [e.id, e]));

function replay(calls: Row["calls"]): PlanModel {
  let i = 0;
  return async () => {
    const call = calls[i++];
    if (!call || call.reply === undefined) {
      throw new Error(call?.error ?? "no recorded reply");
    }
    return call.reply;
  };
}

describe("coach eval replay (30 October, Groq then Gemini)", () => {
  it.each(rows.map((r) => [r.id, r] as const))(
    "%s still ends in a verified coach plan, in no more attempts than recorded",
    async (id, row) => {
      const { profile } = EVAL_PROFILES.find((p) => p.id === id)!;
      const result = await generatePlan(replay(row.calls), profile, library);
      expect(result.source).toBe("COACH");
      expect(result.attempts).toBeLessThanOrEqual(row.attempts);
      expect(verifyPlan(result.plan, profile, byId).ok).toBe(true);
    },
  );

  // On 30 October this reply failed: the model copied the prompt's group labels
  // ("Chest (strength): Dumbbell Flyes") and name matching did not strip them, so 23
  // exercises were "not in the library". normaliseName strips the label now, so the
  // same reply passes first time. If that matching regresses, this fails.
  it("now accepts the shoulder profile's first reply that failed on group labels", async () => {
    const row = rows.find((r) => r.id === "dumbbells-bands-3-days-shoulder")!;
    expect(row.firstReplyPassed).toBe(false);
    const { profile } = EVAL_PROFILES.find((p) => p.id === row.id)!;
    const result = await generatePlan(replay(row.calls), profile, library);
    expect(result.attempts).toBe(1);
  });

  it("recorded 9 of 10 first replies passing on 30 October", () => {
    expect(rows).toHaveLength(10);
    expect(rows.filter((r) => r.firstReplyPassed)).toHaveLength(9);
  });

  // docs/COACH_EVAL.md, Replay in CI: current code passes all ten first replies.
  it("passes 10 of 10 first replies through the current code", async () => {
    const attempts = await Promise.all(
      rows.map(async (row) => {
        const { profile } = EVAL_PROFILES.find((p) => p.id === row.id)!;
        return (await generatePlan(replay(row.calls), profile, library))
          .attempts;
      }),
    );
    expect(attempts).toEqual(Array(10).fill(1));
  });
});
