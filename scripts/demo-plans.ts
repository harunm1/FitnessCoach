// Refreshes src/lib/coach/demoPlans.json from a coach eval run (#59, D12): npx tsx scripts/demo-plans.ts <results.jsonl> <prompt-version>.
import { readFileSync, writeFileSync } from "node:fs";
import {
  firstVerifiedReply,
  planPromptFingerprint,
  type DemoPlanCache,
} from "../src/lib/coach/demoPlans";
import { EVAL_PROFILES } from "../src/lib/coach/evalProfiles";
import type { LibraryExercise } from "../src/lib/coach/verify";

const OUT = "src/lib/coach/demoPlans.json";
const LIBRARY = "eval/fixtures-library.json";
const FIRST_ARG = 2; // argv[0] is node, argv[1] the script
const JSON_INDENT = 2;

type Row = { id: string; calls: { reply?: unknown; error?: string }[] };

const [given, promptVersion] = process.argv.slice(FIRST_ARG);
// Stored with forward slashes, so a run on Windows writes the same file.
const source = given?.replaceAll("\\", "/");
if (!source || !promptVersion) {
  console.error(
    "Usage: npx tsx scripts/demo-plans.ts <eval results .jsonl> <prompt version that produced it>",
  );
  process.exit(1);
}

const rows: Row[] = readFileSync(source, "utf8")
  .trim()
  .split("\n")
  .map((line) => JSON.parse(line));
const library: LibraryExercise[] = JSON.parse(readFileSync(LIBRARY, "utf8"));

// Profiles with more equipment first: a gym user then gets a gym plan before a
// dumbbell-only one, and a plan that needs kit the user lacks fails the verifier.
const ordered = [...EVAL_PROFILES].sort(
  (a, b) => b.profile.equipment.length - a.profile.equipment.length,
);

const plans = ordered.map(({ id, profile }) => {
  const row = rows.find((r) => r.id === id);
  const reply = row && firstVerifiedReply(row.calls, profile, library);
  if (reply === undefined) {
    console.error(`No verified reply for ${id} in ${source}`);
    process.exit(1);
  }
  return { profileId: id, reply };
});

const cache: DemoPlanCache = {
  promptVersion,
  promptFingerprint: planPromptFingerprint(library),
  source,
  plans,
};
writeFileSync(OUT, `${JSON.stringify(cache, null, JSON_INDENT)}\n`);
console.log(`Wrote ${plans.length} plans to ${OUT}`);
