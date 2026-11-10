// Repeated eval runs (#64): each profile N times on one provider, paced under its
// free-tier limits, appended to one results file and resumable after a daily cap.
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { describeRow, evalProfile, setUpEval } from "./evalProfile";
import {
  PROVIDER_LIMITS,
  TOKENS_PER_CALL,
  callGapMs,
  dailyCallBudget,
  paced,
  pendingRuns,
  rateLimitedOut,
  type RunKey,
} from "./pacing";

function doneRuns(file: string): RunKey[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => JSON.parse(line) as RunKey);
}

export async function runRepeats(
  mode: string,
  ids: string[],
  repeat: number,
  file: string,
) {
  if (mode !== "groq" && mode !== "gemini") {
    throw new Error("--repeat runs one provider at a time: groq or gemini");
  }
  const limits = PROVIDER_LIMITS[mode];
  const gapMs = Number(
    process.env.EVAL_GAP_MS ?? callGapMs(limits, TOKENS_PER_CALL),
  );
  const budget = Number(
    process.env.EVAL_MAX_CALLS ?? dailyCallBudget(limits, TOKENS_PER_CALL),
  );
  const ctx = await setUpEval(mode);
  ctx.model = paced(ctx.model, gapMs);

  const todo = pendingRuns(ids, repeat, doneRuns(file));
  console.log(
    `${todo.length} runs to do; ${gapMs} ms between calls, at most ${budget} calls this session`,
  );
  let callsMade = 0;
  for (const key of todo) {
    // A run can take two calls (a rejected plan is retried once).
    if (callsMade + 2 > budget) {
      console.log(
        `stopping at the daily budget (${callsMade} calls); rerun to resume`,
      );
      break;
    }
    const row = await evalProfile(ctx, key.id);
    callsMade += row.calls.length;
    if (rateLimitedOut(row.calls)) {
      console.log(
        `${key.id} run ${key.run}: rate limited on every call; stopping, rerun to resume`,
      );
      break;
    }
    const record = { run: key.run, at: new Date().toISOString(), ...row };
    appendFileSync(file, JSON.stringify(record) + "\n");
    console.log(`run ${key.run} ${describeRow(row)}`);
  }
  console.log(`results in ${file}`);
}
