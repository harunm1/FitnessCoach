// The rows of a repeat results file (#64): which runs count and how they feed the consistency measures.
import type { RepeatRun } from "../src/lib/coach/consistency";
import { isTransportError, type RunKey } from "./pacing";

type CallLike = {
  ms: number;
  reply?: unknown;
  error?: string;
  problems?: string[];
};

// A run counts unless the first call failed in transport (429, 503, a dropped
// request): that says nothing about the coach's plans, so the run is left to be done
// again. A first call that returned a bad reply, or never answered within our own
// timeout, is a real failure of the first reply and counts as one.
export function firstCallAnswered(calls: CallLike[]): boolean {
  const first = calls[0];
  if (!first) return false;
  return first.reply !== undefined || !isTransportError(first.error);
}

// The first call is the one the user waits for and the one the pass rate counts.
export function toRepeatRun(row: {
  firstReplyPassed: boolean;
  calls: CallLike[];
}): RepeatRun {
  const answered = firstCallAnswered(row.calls);
  return {
    firstReplyPassed: row.firstReplyPassed,
    reply: answered ? (row.calls[0].reply ?? null) : null,
    ms: answered && row.calls[0].reply !== undefined ? row.calls[0].ms : null,
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
