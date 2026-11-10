// Prints the per-profile consistency table (#64) for one repeat results file, in the
// form docs/COACH_EVAL.md uses.
//   npx tsx eval/consistencyReport.ts eval/results/<date>-groq-repeat.jsonl
import { readFileSync } from "node:fs";
import { consistency, type RepeatRun } from "../src/lib/coach/consistency";
import type { EvalRow } from "./evalProfile";

// The first call is the one the user waits for, and the one the pass rate counts.
function toRepeatRun(row: EvalRow): RepeatRun {
  const first = row.calls[0];
  const answered = first?.reply !== undefined;
  return {
    firstReplyPassed: row.firstReplyPassed,
    reply: answered ? first.reply : null,
    ms: answered ? first.ms : null,
  };
}

const seconds = (ms: number) => `${(ms / 1000).toFixed(1)} s`;

function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: consistencyReport.ts <results file>");
  const rows = readFileSync(file, "utf8")
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as EvalRow);
  const byProfile = Map.groupBy(rows, (r) => r.id);
  const models = [...new Set(rows.flatMap((r) => r.served))];

  console.log(`Models: ${models.join(", ")}\n`);
  console.log(
    "| Profile | Runs | First reply passes | Unique replies | Exercise overlap | Weekly sets | Mean reps | First call, median and slowest |",
  );
  console.log("| --- | --- | --- | --- | --- | --- | --- | --- |");
  for (const [id, profileRows] of byProfile) {
    const c = consistency(profileRows.map(toRepeatRun));
    const span = (r: { min: number; max: number } | null, digits = 0) =>
      r ? `${r.min.toFixed(digits)} to ${r.max.toFixed(digits)}` : "n/a";
    console.log(
      `| ${id} | ${c.runs} | ${c.firstReplyPassed} of ${c.runs} | ${c.uniqueReplies} | ` +
        `${c.exerciseOverlap === null ? "n/a" : c.exerciseOverlap.toFixed(2)} | ` +
        `${span(c.weeklySets)} | ${span(c.meanReps, 1)} | ` +
        `${c.latencyMs ? `${seconds(c.latencyMs.median)}, ${seconds(c.latencyMs.slowest)}` : "n/a"} |`,
    );
  }
}

main();
