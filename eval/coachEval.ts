// Runs the eval profiles against the coach and appends one JSON line per profile to
// eval/results/<date>-<label>.jsonl: every reply, verifier result, retry, fallback and
// timing. Needs keys in .env; never runs in CI. Criteria and results:
// docs/COACH_EVAL.md.
//   npx tsx eval/coachEval.ts groq round2              all ten profiles, Groq only
//   npx tsx eval/coachEval.ts gemini round2 gym-3-days one profile, Gemini only
//   npx tsx eval/coachEval.ts chain round2             Groq, then Gemini on failure
// PAUSE_MS sets the wait between profiles (default 3000).
import "dotenv/config";
import { appendFileSync, mkdirSync } from "node:fs";
import { EVAL_PROFILES } from "../src/lib/coach/evalProfiles";
import {
  generatePlan,
  namesToIds,
  type PlanModel,
} from "../src/lib/coach/generatePlan";
import { coachModel, type ProviderEvent } from "../src/lib/coach/providers";
import {
  fitsProfile,
  verifyPlan,
  type LibraryExercise,
} from "../src/lib/coach/verify";

const EXERCISES_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";

async function main() {
  const mode = process.argv[2] ?? "groq";
  const label = process.argv[3] ?? "run";
  const only = process.argv[4]?.split(",");
  const pauseMs = Number(process.env.PAUSE_MS ?? 3000);

  // "groq" or "gemini" sees only that provider's key, so nothing falls back; "chain"
  // is the production setup, Groq first with Gemini behind it.
  const env =
    mode === "chain"
      ? { ...process.env, COACH_PROVIDER: "groq" }
      : {
          COACH_PROVIDER: mode,
          [`${mode.toUpperCase()}_API_KEY`]:
            process.env[`${mode.toUpperCase()}_API_KEY`],
        };
  const events: ProviderEvent[] = [];
  const model = coachModel(env, { onEvent: (e) => events.push(e) });

  // The whole library, as the seed stores it: nothing is capped or filtered here.
  const all = (await (
    await fetch(EXERCISES_URL)
  ).json()) as (LibraryExercise & {
    name: string;
    category: string;
  })[];
  const library: LibraryExercise[] = all.map((e) => ({
    id: e.id,
    name: e.name,
    category: e.category,
    equipment: e.equipment,
    primaryMuscles: e.primaryMuscles,
    secondaryMuscles: e.secondaryMuscles,
  }));
  const byId = new Map(library.map((e) => [e.id, e]));
  mkdirSync("eval/results", { recursive: true });
  const file = `eval/results/${new Date().toISOString().slice(0, 10)}-${mode}-${label}.jsonl`;

  const profiles = EVAL_PROFILES.filter((p) => !only || only.includes(p.id));
  for (const [i, { id, profile }] of profiles.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, pauseMs));
    events.length = 0;
    const calls: {
      ms: number;
      error?: string;
      problems?: string[];
      reply?: unknown;
    }[] = [];
    // Wraps the model to record each call's time, error and verifier result.
    const timed: PlanModel = async (prompt) => {
      const start = performance.now();
      try {
        const reply = await model(prompt);
        const check = verifyPlan(namesToIds(reply, library), profile, byId);
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
    const result = await generatePlan(timed, profile, library);
    const row = {
      id,
      offered: library.filter((e) => fitsProfile(e, profile)).length,
      source: result.source,
      attempts: result.attempts,
      firstReplyPassed: calls[0]?.problems?.length === 0,
      events: [...events],
      calls,
    };
    appendFileSync(file, JSON.stringify(row) + "\n");
    console.log(
      `${id} (${row.offered} offered): ${result.source}, attempts ${result.attempts}, ` +
        calls
          .map(
            (c) =>
              `${c.ms} ms${c.error ? ` (${c.error})` : c.problems?.length ? ` (${c.problems.join("; ")})` : ""}`,
          )
          .join(", ") +
        (events.length
          ? ` | ${events.map((e) => `${e.action} ${e.provider} ${e.status ?? ""}${e.waitMs ? ` ${e.waitMs} ms` : ""}`).join(", ")}`
          : ""),
    );
  }
  console.log(`appended to ${file}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
