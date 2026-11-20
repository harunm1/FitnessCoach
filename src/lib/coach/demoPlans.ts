// Pre-generated coach plans served in demo mode when both providers fail (D12, #59); refreshed by scripts/demo-plans.ts.
import { createHash } from "node:crypto";
import cache from "./demoPlans.json";
import { EVAL_PROFILES } from "./evalProfiles";
import { buildPlanPrompt, namesToIds } from "./generatePlan";
import { isDemoMode } from "./providers";
import {
  fitsProfile,
  verifyPlan,
  type LibraryExercise,
  type VerifyProfile,
} from "./verify";

// A real reply from the coach, kept with exercise names as the model wrote them. Names
// are mapped to ids and verified against each user's own profile when served.
export type CachedPlan = { profileId: string; reply: unknown };

export type DemoPlanCache = {
  promptVersion: string; // PLAN_PROMPT_VERSION of the prompt that produced the replies
  promptFingerprint: string; // planPromptFingerprint() when the cache was written
  source: string; // the eval results file the replies come from
  plans: CachedPlan[];
};

export const DEMO_PLAN_CACHE: DemoPlanCache = cache;

// The cache to pass to generatePlan, or undefined outside demo mode.
export function demoPlans(
  env: Record<string, string | undefined> = process.env,
): CachedPlan[] | undefined {
  return isDemoMode(env) ? DEMO_PLAN_CACHE.plans : undefined;
}

// A hash of the plan prompt built for a fixed profile and library, first try and
// retry. Any change to the prompt's wording changes it, version bump or not, so a
// test can say the cache needs a refresh (scripts/demo-plans.ts).
export function planPromptFingerprint(library: LibraryExercise[]): string {
  const { profile } = EVAL_PROFILES[0];
  const usable = library.filter((e) => fitsProfile(e, profile));
  const prompts = [
    buildPlanPrompt(profile, usable),
    buildPlanPrompt(profile, usable, ["a listed problem"]),
  ];
  return createHash("sha256").update(prompts.join("\n---\n")).digest("hex");
}

type RecordedCall = { reply?: unknown; error?: string };

// Picks the first recorded reply that passes the verifier for the profile it was
// written for. Used by scripts/demo-plans.ts when the cache is refreshed.
export function firstVerifiedReply(
  calls: RecordedCall[],
  profile: VerifyProfile,
  library: LibraryExercise[],
): unknown {
  const usable = library.filter((e) => fitsProfile(e, profile));
  const byId = new Map(library.map((e) => [e.id, e]));
  return calls.find(
    (call) =>
      call.reply !== undefined &&
      verifyPlan(namesToIds(call.reply, usable), profile, byId).ok,
  )?.reply;
}
