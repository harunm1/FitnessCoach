// The rows of a repeat results file (#64): which runs count and how they feed the consistency measures.
import type { RepeatRun } from "../src/lib/coach/consistency";
import type { RunKey } from "./pacing";

type CallLike = {
  ms: number;
  reply?: unknown;
  error?: string;
  problems?: string[];
};

// A run counts only when the first call reached the model. A 429 or 503 on the first
// call says nothing about the coach's plans; the run is left to be done again.
export function firstCallAnswered(calls: CallLike[]): boolean {
  return calls[0]?.reply !== undefined;
}

// The first call is the one the user waits for and the one the pass rate counts.
export function toRepeatRun(row: {
  firstReplyPassed: boolean;
  calls: CallLike[];
}): RepeatRun {
  const answered = firstCallAnswered(row.calls);
  return {
    firstReplyPassed: row.firstReplyPassed,
    reply: answered ? row.calls[0].reply : null,
    ms: answered ? row.calls[0].ms : null,
  };
}

export function parseDoneRuns(text: string): RunKey[] {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const { id, run } = JSON.parse(line) as RunKey;
      return { id, run };
    });
}
