// How consistent the coach is when one eval profile is sent several times (#64).
// Measures follow Lee (2026, arXiv 2604.19598): exact duplicates counted per profile,
// alongside the verifier pass rate; structured fields are compared, not text
// embeddings (docs/papers/2026-lee-cross-model-consistency.md).

import { z } from "zod";
import { normaliseName } from "./generatePlan";

// One repeat: whether the first reply passed the verifier, the reply itself (null
// when every call failed) and the first call's time (null when it never answered).
export type RepeatRun = {
  firstReplyPassed: boolean;
  reply: unknown;
  ms: number | null;
};

export type Consistency = {
  runs: number;
  firstReplyPassed: number;
  uniqueReplies: number;
  exactDuplicates: number;
  // Mean Jaccard overlap of the exercises chosen, over every pair of plans (1 = same
  // exercises every time); null with fewer than two readable plans.
  exerciseOverlap: number | null;
  weeklySets: Range | null;
  meanReps: Range | null;
  latencyMs: { median: number; slowest: number } | null;
};

type Range = { min: number; max: number };

// The reply fields compared here, read leniently: the verifier judges the rest.
const replySchema = z.object({
  days: z.array(
    z.object({
      exercises: z.array(
        z.object({ exercise: z.string(), sets: z.number(), reps: z.number() }),
      ),
    }),
  ),
});

type Plan = { exercises: Set<string>; weeklySets: number; meanReps: number };

function readPlan(reply: unknown): Plan | null {
  const parsed = replySchema.safeParse(reply);
  if (!parsed.success) return null;
  const slots = parsed.data.days.flatMap((d) => d.exercises);
  if (slots.length === 0) return null;
  return {
    exercises: new Set(slots.map((e) => normaliseName(e.exercise))),
    weeklySets: slots.reduce((sum, e) => sum + e.sets, 0),
    meanReps: slots.reduce((sum, e) => sum + e.reps, 0) / slots.length,
  };
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const shared = [...a].filter((x) => b.has(x)).length;
  return shared / (a.size + b.size - shared);
}

function meanPairwiseOverlap(plans: Plan[]): number | null {
  const scores: number[] = [];
  plans.forEach((a, i) =>
    plans
      .slice(i + 1)
      .forEach((b) => scores.push(jaccard(a.exercises, b.exercises))),
  );
  return scores.length
    ? scores.reduce((s, x) => s + x, 0) / scores.length
    : null;
}

function range(values: number[]): Range | null {
  return values.length
    ? { min: Math.min(...values), max: Math.max(...values) }
    : null;
}

// JSON with object keys sorted, so two replies that differ only in key order match.
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value).sort(([a], [b]) =>
      a.localeCompare(b),
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function consistency(runs: RepeatRun[]): Consistency {
  const replies = runs
    .filter((r) => r.reply != null)
    .map((r) => canonical(r.reply));
  const unique = new Set(replies).size;
  const plans = runs.flatMap((r) => readPlan(r.reply) ?? []);
  const times = runs.flatMap((r) => (r.ms === null ? [] : [r.ms]));
  return {
    runs: runs.length,
    firstReplyPassed: runs.filter((r) => r.firstReplyPassed).length,
    uniqueReplies: unique,
    exactDuplicates: replies.length - unique,
    exerciseOverlap: meanPairwiseOverlap(plans),
    weeklySets: range(plans.map((p) => p.weeklySets)),
    meanReps: range(plans.map((p) => p.meanReps)),
    latencyMs: times.length
      ? { median: median(times), slowest: Math.max(...times) }
      : null,
  };
}
