// One eval profile sent to the coach once: the provider set-up and the row each run
// writes to eval/results/ (every reply, verifier result, retry, fallback and timing).
import { EVAL_PROFILES } from "../src/lib/coach/evalProfiles";
import {
  generatePlan,
  namesToIds,
  type PlanModel,
} from "../src/lib/coach/generatePlan";
import {
  coachModel,
  type ProviderEvent,
  type RetryOptions,
} from "../src/lib/coach/providers";
import {
  fitsProfile,
  verifyPlan,
  type LibraryExercise,
} from "../src/lib/coach/verify";

const EXERCISES_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

export type EvalContext = {
  model: PlanModel;
  // Awaited before each call and outside its timer (the repeat runner's pacer).
  beforeCall?: () => Promise<void>;
  events: ProviderEvent[];
  library: LibraryExercise[];
  byId: Map<string, LibraryExercise>;
};

export type Call = {
  ms: number;
  error?: string;
  problems?: string[];
  reply?: unknown;
};

export type EvalRow = {
  id: string;
  offered: number;
  source: string;
  attempts: number;
  firstReplyPassed: boolean;
  served: string[];
  events: ProviderEvent[];
  calls: Call[];
};

// "groq" or "gemini" sees only that provider's key, so nothing falls back; "chain"
// is the production setup, Groq first with Gemini behind it.
// retry is passed to the providers' withRetry; repeat runs turn retries off so every
// HTTP request is a paced, counted call.
export async function setUpEval(
  mode: string,
  retry: Pick<RetryOptions, "retries"> = {},
): Promise<EvalContext> {
  const env =
    mode === "chain"
      ? { ...process.env, COACH_PROVIDER: process.env.COACH_PROVIDER ?? "groq" }
      : {
          COACH_PROVIDER: mode,
          [`${mode.toUpperCase()}_API_KEY`]:
            process.env[`${mode.toUpperCase()}_API_KEY`],
          GROQ_MODEL: process.env.GROQ_MODEL,
          GEMINI_MODEL: process.env.GEMINI_MODEL,
        };
  const events: ProviderEvent[] = [];
  const model = coachModel(env, { ...retry, onEvent: (e) => events.push(e) });

  // The whole library, as the seed stores it: nothing is capped or filtered here.
  const all = (await (
    await fetch(EXERCISES_URL)
  ).json()) as (LibraryExercise & { name: string; category: string })[];
  const library: LibraryExercise[] = all.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    equipment: e.equipment,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
  }));
  return {
    model,
    events,
    library,
    byId: new Map(library.map((e) => [e.id, e])),
  };
}

export async function evalProfile(
  ctx: EvalContext,
  id: string,
): Promise<EvalRow> {
  const entry = EVAL_PROFILES.find((p) => p.id === id);
  if (!entry) throw new Error(`Unknown eval profile ${id}`);
  const { profile } = entry;
  ctx.events.length = 0;
  const calls: Call[] = [];
  // Wraps the model to record each call's time, error and verifier result.
  const timed: PlanModel = async (prompt) => {
    await ctx.beforeCall?.();
    const start = performance.now();
    try {
      const reply = await ctx.model(prompt);
      const check = verifyPlan(
        namesToIds(reply, ctx.library),
        profile,
        ctx.byId,
      );
      calls.push({
        ms: Math.round(performance.now() - start),
        reply,
        problems: check.ok ? [] : check.problems,
      });
      return reply;
    } catch (e) {
      calls.push({
        ms: Math.round(performance.now() - start),
        error: (e as Error).message,
      });
      throw e;
    }
  };
  const result = await generatePlan(timed, profile, ctx.library);
  return {
    id,
    offered: ctx.library.filter((e) => fitsProfile(e, profile)).length,
    source: result.source,
    attempts: result.attempts,
    firstReplyPassed: calls[0]?.problems?.length === 0,
    // "served" names who answered each call; kept apart so a non-empty events
    // list still means a retry or a switch happened, as in the 30 October files.
    served: ctx.events
      .filter((e) => e.action === "served")
      .map((e) => `${e.provider} ${e.model ?? ""}`.trim()),
    events: ctx.events.filter((e) => e.action !== "served"),
    calls,
  };
}

// One console line per row, as the 30 October runs printed.
export function describeRow(row: EvalRow): string {
  return (
    `${row.id} (${row.offered} offered): ${row.source}, attempts ${row.attempts}, ` +
    row.calls
      .map(
        (c) =>
          `${c.ms} ms${c.error ? ` (${c.error})` : c.problems?.length ? ` (${c.problems.join("; ")})` : ""}`,
      )
      .join(", ") +
    (row.events.length
      ? ` | ${row.events.map((e) => `${e.action} ${e.provider} ${e.status ?? ""}${e.waitMs ? ` ${e.waitMs} ms` : ""}`).join(", ")}`
      : "")
  );
}
