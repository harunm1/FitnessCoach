// Runs the ten eval profiles against one provider and writes every reply, verifier
// result and timing to eval/results/. Needs a key in .env; never runs in CI.
//   npx tsx eval/coachEval.ts groq
//   npx tsx eval/coachEval.ts gemini
//   npx tsx eval/coachEval.ts groq rerun gym-3-days,bodyweight-2-days
// Criteria and results: docs/COACH_EVAL.md.
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import { EVAL_PROFILES } from "../src/lib/coach/evalProfiles";
import { generatePlan, type PlanModel } from "../src/lib/coach/generatePlan";
import {
  coachModel,
  GEMINI_MODEL,
  GROQ_MODEL,
} from "../src/lib/coach/providers";
import {
  verifyPlan,
  type LibraryExercise,
  type VerifyProfile,
} from "../src/lib/coach/verify";

const EXERCISES_URL =
  "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/dist/exercises.json";
const PER_MUSCLE = 6;
const PAUSE_MS = 3_000; // between profiles, to stay under free-tier per-minute limits

type SourceExercise = LibraryExercise & { category: string; level: string };

// The exercise list offered to the model: strength moves this user can do, below
// expert level, at most PER_MUSCLE per primary muscle, sorted by id so every run
// sends the same list.
function offered(all: SourceExercise[], p: VerifyProfile): LibraryExercise[] {
  const owned = new Set(p.equipment);
  const avoid = new Set(p.avoidMuscles);
  const perMuscle = new Map<string, number>();
  return all
    .filter(
      (e) =>
        e.category === "strength" &&
        e.level !== "expert" &&
        (e.equipment === null ||
          e.equipment === "body only" ||
          owned.has(e.equipment)) &&
        ![...e.primaryMuscles, ...e.secondaryMuscles].some((m) => avoid.has(m)),
    )
    .sort((a, b) => a.id.localeCompare(b.id))
    .filter((e) => {
      const m = e.primaryMuscles[0];
      const n = perMuscle.get(m) ?? 0;
      perMuscle.set(m, n + 1);
      return n < PER_MUSCLE;
    })
    .map(({ id, equipment, primaryMuscles, secondaryMuscles }) => ({
      id,
      equipment,
      primaryMuscles,
      secondaryMuscles,
    }));
}

async function main() {
  const provider = process.argv[2] ?? "groq";
  // Optional: a label for the results file and a comma-separated list of profile ids.
  const label = process.argv[3];
  const only = process.argv[4]?.split(",");
  process.env.COACH_PROVIDER = provider;
  const model = coachModel();
  const modelName = provider === "gemini" ? GEMINI_MODEL : GROQ_MODEL;
  const all = (await (await fetch(EXERCISES_URL)).json()) as SourceExercise[];
  const rows = [];

  const profiles = EVAL_PROFILES.filter((p) => !only || only.includes(p.id));
  for (const { id, profile } of profiles) {
    const library = offered(all, profile);
    const byId = new Map(library.map((e) => [e.id, e]));
    const calls: {
      ms: number;
      error?: string;
      problems?: string[];
      reply?: unknown;
    }[] = [];
    // Wraps the provider to record each call's time, error and verifier result.
    const timed: PlanModel = async (prompt) => {
      const start = performance.now();
      try {
        const reply = await model(prompt);
        const check = verifyPlan(reply, profile, byId);
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
    rows.push({
      id,
      offered: library.length,
      source: result.source,
      attempts: result.attempts,
      firstReplyPassed: calls[0]?.problems?.length === 0,
      calls,
    });
    console.log(
      `${id}: ${result.source}, attempts ${result.attempts}, ${calls.map((c) => `${c.ms} ms${c.error ? ` (${c.error})` : c.problems?.length ? ` (${c.problems.length} problems)` : ""}`).join(", ")}`,
    );
    await new Promise((r) => setTimeout(r, PAUSE_MS));
  }

  mkdirSync("eval/results", { recursive: true });
  const file = `eval/results/${new Date().toISOString().slice(0, 10)}-${provider}${label ? `-${label}` : ""}.json`;
  writeFileSync(
    file,
    JSON.stringify({ provider, model: modelName, rows }, null, 2) + "\n",
  );
  console.log(`wrote ${file}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
