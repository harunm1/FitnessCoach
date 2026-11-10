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
} from "./pacing";
import { firstCallAnswered, parseDoneRuns } from "./repeatRow";

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
  // Retries off: each HTTP request is one paced call against the budget, and a run
  // whose first call fails in transport is left pending instead of retried in a burst.
  const ctx = await setUpEval(mode, { retries: 0 });
  ctx.model = paced(ctx.model, gapMs);

  const done = existsSync(file)
    ? parseDoneRuns(readFileSync(file, "utf8"))
    : [];
  const todo = pendingRuns(ids, repeat, done);
  const resume = `npx tsx eval/coachEval.ts ${mode} repeat --repeat ${repeat} --file ${file}`;
  // The budget is per session, not carried over: a second session on the same day
  // can still meet the provider's daily cap, which the 429 stop below catches.
  console.log(
    `${todo.length} runs to do; ${gapMs} ms between calls, at most ${budget} calls this session`,
  );
  let callsMade = 0;
  for (const key of todo) {
    // A run can take two calls (a rejected plan is retried once).
    if (callsMade + 2 > budget) {
      console.log(
        `stopping at the budget (${callsMade} calls); resume: ${resume}`,
      );
      break;
    }
    const row = await evalProfile(ctx, key.id);
    callsMade += row.calls.length;
    if (rateLimitedOut(row.calls)) {
      console.log(
        `${key.id} run ${key.run}: refused with 429; stopping. Resume: ${resume}`,
      );
      break;
    }
    if (!firstCallAnswered(row.calls)) {
      console.log(
        `${key.id} run ${key.run}: first call failed (${row.calls[0]?.error}); left pending`,
      );
      continue;
    }
    const record = { run: key.run, at: new Date().toISOString(), ...row };
    appendFileSync(file, JSON.stringify(record) + "\n");
    console.log(`run ${key.run} ${describeRow(row)}`);
  }
  console.log(`results in ${file}`);
}
