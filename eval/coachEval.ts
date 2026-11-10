// Runs the eval profiles against the coach and appends one JSON line per run to
// eval/results/: every reply, verifier result, retry, fallback and timing. Needs
// keys in .env; never runs in CI. Criteria and results: docs/COACH_EVAL.md.
//   npx tsx eval/coachEval.ts groq round2              all ten profiles, Groq only
//   npx tsx eval/coachEval.ts gemini round2 gym-3-days one profile, Gemini only
//   npx tsx eval/coachEval.ts chain round2             Groq, then Gemini on failure
//   npx tsx eval/coachEval.ts groq repeat --repeat 5   each profile five times (#64),
//     paced under the free-tier limits in eval/pacing.ts. To resume after a daily cap,
//     rerun with --file <that day's file>; the runner prints the exact command.
// PAUSE_MS sets the wait between profiles in single runs (default 3000).
import "dotenv/config";
import { appendFileSync, mkdirSync } from "node:fs";
import { EVAL_PROFILES } from "../src/lib/coach/evalProfiles";
import { parseArgs } from "./args";
import { describeRow, evalProfile, setUpEval } from "./evalProfile";
import { runRepeats } from "./repeatRun";

async function main() {
  const {
    mode,
    label,
    only,
    repeat,
    file: fileArg,
  } = parseArgs(process.argv.slice(2));
  const ids = EVAL_PROFILES.map((p) => p.id).filter(
    (id) => !only || only.includes(id),
  );
  mkdirSync("eval/results", { recursive: true });
  const file =
    fileArg ??
    `eval/results/${new Date().toISOString().slice(0, 10)}-${mode}-${label}.jsonl`;

  if (repeat) return runRepeats(mode, ids, repeat, file);

  const pauseMs = Number(process.env.PAUSE_MS ?? 3000);
  const ctx = await setUpEval(mode);
  for (const [i, id] of ids.entries()) {
    if (i > 0) await new Promise((r) => setTimeout(r, pauseMs));
    const row = await evalProfile(ctx, id);
    appendFileSync(file, JSON.stringify(row) + "\n");
    console.log(describeRow(row));
  }
  console.log(`appended to ${file}`);
}

main().catch((e) => {
  console.error((e as Error).message);
  process.exit(1);
});
