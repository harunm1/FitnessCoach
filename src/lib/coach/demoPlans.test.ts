// The demo plan cache (#59, D12): real coach plans served when both providers fail in demo mode, checked by the verifier.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_PROMPT_VERSION, type CoachRecord } from "./coachLog";
import {
  DEMO_PLAN_CACHE,
  demoPlans,
  firstVerifiedReply,
  planPromptFingerprint,
  type CachedPlan,
} from "./demoPlans";
import { EVAL_PROFILES } from "./evalProfiles";
import { generatePlan, type PlanModel } from "./generatePlan";
import { ProviderError } from "./providers";
import { verifyPlan, type LibraryExercise, type VerifyProfile } from "./verify";

// The exercises the 30 October replies name, with the fields the app stores.
const library: LibraryExercise[] = JSON.parse(
  readFileSync("eval/fixtures-library.json", "utf8"),
);
const byId = new Map(library.map((e) => [e.id, e]));
const HTTP_TOO_MANY = 429;
const ONE_CALL = 1;
const BOTH_ATTEMPTS = 2;
const THREE_DAYS = 3;
const SIX_DAYS = 6;
const SEVEN_DAYS = 7;

// The seeded demo user (prisma/seed.ts): three days, barbell, dumbbells, body weight.
const demoUser: VerifyProfile = {
  daysPerWeek: THREE_DAYS,
  equipment: ["barbell", "dumbbell", "body only"],
  avoidMuscles: [],
};
// Seven days on kettlebells only: no cached plan has that shape.
const noMatch: VerifyProfile = {
  daysPerWeek: SEVEN_DAYS,
  equipment: ["kettlebells"],
  avoidMuscles: [],
};

const providersDown = (): { model: PlanModel; calls: () => number } => {
  let calls = 0;
  return {
    model: async () => {
      calls++;
      throw new ProviderError(
        "Gemini returned HTTP 429",
        "Gemini",
        HTTP_TOO_MANY,
      );
    },
    calls: () => calls,
  };
};
const rejectedEveryTime: PlanModel = async () => ({ name: "P", days: [] });

const records = () => {
  const list: CoachRecord[] = [];
  return { list, log: (r: CoachRecord) => void list.push(r) };
};

describe("the cached plans", () => {
  it("were written for the current plan prompt; a prompt change needs a refresh", () => {
    expect(DEMO_PLAN_CACHE.promptVersion).toBe(PLAN_PROMPT_VERSION);
  });

  it("match the plan prompt's current wording, even without a version bump", () => {
    expect(DEMO_PLAN_CACHE.promptFingerprint).toBe(
      planPromptFingerprint(library),
    );
  });

  it("cover every eval profile, and each passes the verifier for its own profile", async () => {
    expect(DEMO_PLAN_CACHE.plans.map((p) => p.profileId).sort()).toEqual(
      EVAL_PROFILES.map((p) => p.id).sort(),
    );
    const results = await Promise.all(
      EVAL_PROFILES.map(async ({ id, profile }) => {
        const own = DEMO_PLAN_CACHE.plans.filter((p) => p.profileId === id);
        const result = await generatePlan(
          providersDown().model,
          profile,
          library,
          { demoPlans: own },
        );
        return {
          id,
          cached: result.cached,
          ok: verifyPlan(result.plan, profile, byId).ok,
        };
      }),
    );
    expect(results.filter((r) => !r.cached || !r.ok)).toEqual([]);
  });

  it("are served only in demo mode", () => {
    expect(demoPlans({ COACH_DEMO_MODE: "1" })).toBe(DEMO_PLAN_CACHE.plans);
    expect(demoPlans({})).toBeUndefined();
  });
});

describe("generatePlan in demo mode", () => {
  it("serves a cached plan that fits the user when both providers are down, without a second attempt", async () => {
    const down = providersDown();
    const { list, log } = records();
    const result = await generatePlan(down.model, demoUser, library, {
      demoPlans: DEMO_PLAN_CACHE.plans,
      log,
    });
    expect(down.calls()).toBe(ONE_CALL);
    expect(result).toMatchObject({ source: "COACH", cached: true });
    expect(verifyPlan(result.plan, demoUser, byId).ok).toBe(true);
    expect(list.map((r) => r.outcome)).toEqual(["error", "cached"]);
    const served = list.at(-1);
    expect(DEMO_PLAN_CACHE.plans.map((p) => p.profileId)).toContain(
      served?.cachedProfileId,
    );
    // A provider failure is not a fault in a reply, so no problem is listed.
    expect(served?.problems).toEqual([]);
  });

  it("serves a cached plan after one rejected reply instead of asking again", async () => {
    let calls = 0;
    const rejected: PlanModel = async (prompt) => {
      calls++;
      return rejectedEveryTime(prompt);
    };
    const result = await generatePlan(rejected, demoUser, library, {
      demoPlans: DEMO_PLAN_CACHE.plans,
    });
    expect(calls).toBe(ONE_CALL);
    expect(result).toMatchObject({
      source: "COACH",
      cached: true,
      attempts: ONE_CALL,
    });
  });

  it("gives the rule-based plan when no cached plan fits the user", async () => {
    const { list, log } = records();
    const result = await generatePlan(providersDown().model, noMatch, library, {
      demoPlans: DEMO_PLAN_CACHE.plans,
      log,
    });
    expect(result.source).toBe("DEFAULT");
    expect(result.cached).toBe(false);
    expect(list.at(-1)?.outcome).toBe("rule_based");
  });

  it("skips a cached plan whose exercises the user cannot do", async () => {
    const gymOnly = DEMO_PLAN_CACHE.plans.filter(
      (p) => p.profileId === "machines-6-days",
    );
    const sixDaysDumbbells: VerifyProfile = {
      daysPerWeek: SIX_DAYS,
      equipment: ["dumbbell"],
      avoidMuscles: [],
    };
    const result = await generatePlan(
      providersDown().model,
      sixDaysDumbbells,
      library,
      { demoPlans: gymOnly },
    );
    expect(result.source).toBe("DEFAULT");
  });
});

describe("generatePlan outside demo mode", () => {
  it("still asks twice and never marks a plan cached", async () => {
    const down = providersDown();
    const result = await generatePlan(down.model, demoUser, library);
    expect(down.calls()).toBe(BOTH_ATTEMPTS);
    expect(result).toMatchObject({ source: "DEFAULT", cached: false });
  });
});

describe("firstVerifiedReply", () => {
  const [{ profile }] = EVAL_PROFILES;
  const good: CachedPlan["reply"] = DEMO_PLAN_CACHE.plans.find(
    (p) => p.profileId === EVAL_PROFILES[0].id,
  )?.reply;

  it("skips failed calls and rejected replies and keeps the first that passes", () => {
    const calls = [
      { error: "Groq returned HTTP 429" },
      { reply: { name: "P", days: [] } },
      { reply: good },
    ];
    expect(firstVerifiedReply(calls, profile, library)).toEqual(good);
  });

  it("returns undefined when no reply passes", () => {
    expect(
      firstVerifiedReply([{ error: "timed out" }], profile, library),
    ).toBeUndefined();
  });
});
