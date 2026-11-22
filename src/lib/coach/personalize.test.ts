// "Personalize with the coach" (#58): the order of steps and what the user is told.
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  CACHED_MESSAGE,
  KEPT_MESSAGE,
  NO_GYM_PROFILE_MESSAGE,
  SAVE_FAILED_MESSAGE,
  SAVED_MESSAGE,
  UNAVAILABLE_MESSAGE,
  personalizePlan,
  type PersonalizeSteps,
} from "./personalize";
import { generatePlan, type GeneratedPlan } from "./generatePlan";
import { ProviderError } from "./providers";

const COOLDOWN_SECONDS = 42;
const HTTP_UNAVAILABLE = 503;
const DAYS_PER_WEEK = 3;
const plan = { name: "3-day coach plan", days: [] };
const inputs = {
  profile: {
    daysPerWeek: DAYS_PER_WEEK,
    equipment: ["dumbbell"],
    avoidMuscles: [],
  },
  library: [],
};
const coachPlan: GeneratedPlan = {
  plan,
  source: "COACH",
  attempts: 1,
  cached: false,
};
const rulePlan: GeneratedPlan = { ...coachPlan, source: "DEFAULT" };

type StepMocks = { [K in keyof PersonalizeSteps]: Mock<PersonalizeSteps[K]> };

function steps(overrides: Partial<StepMocks> = {}): StepMocks {
  return {
    loadInputs: vi.fn().mockResolvedValue(inputs),
    claim: vi.fn().mockResolvedValue({ allowed: true, retryAfterSeconds: 0 }),
    generate: vi.fn().mockResolvedValue(coachPlan),
    save: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

describe("personalizePlan", () => {
  it("saves a verified coach plan, after validation and the request claim", async () => {
    const s = steps();
    expect(await personalizePlan(s)).toEqual({
      status: "saved",
      message: SAVED_MESSAGE,
    });
    expect(s.generate).toHaveBeenCalledWith(inputs.profile, inputs.library);
    expect(s.save).toHaveBeenCalledWith(plan);
    const order = [s.loadInputs, s.claim, s.generate, s.save].map(
      (fn) => fn.mock.invocationCallOrder[0],
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("returns the remaining cooldown and calls no model when the claim is refused", async () => {
    const s = steps({
      claim: vi.fn().mockResolvedValue({
        allowed: false,
        retryAfterSeconds: COOLDOWN_SECONDS,
        message: "Please wait 42 seconds before requesting another plan.",
      }),
    });
    expect(await personalizePlan(s)).toEqual({
      status: "error",
      message: "Please wait 42 seconds before requesting another plan.",
      retryAfterSeconds: COOLDOWN_SECONDS,
    });
    expect(s.generate).not.toHaveBeenCalled();
    expect(s.save).not.toHaveBeenCalled();
  });

  it("claims nothing and calls no model without a gym profile", async () => {
    const s = steps({ loadInputs: vi.fn().mockResolvedValue(null) });
    expect(await personalizePlan(s)).toEqual({
      status: "error",
      message: NO_GYM_PROFILE_MESSAGE,
    });
    expect(s.claim).not.toHaveBeenCalled();
    expect(s.generate).not.toHaveBeenCalled();
  });

  it("keeps the current plan when the coach falls back to the rule-based plan (verifier rejection or provider down)", async () => {
    const s = steps({ generate: vi.fn().mockResolvedValue(rulePlan) });
    expect(await personalizePlan(s)).toEqual({
      status: "kept",
      message: KEPT_MESSAGE,
    });
    expect(s.save).not.toHaveBeenCalled();
  });

  it("keeps the current plan when generation throws", async () => {
    const s = steps({
      generate: vi.fn().mockRejectedValue(new Error("not enough exercises")),
    });
    expect((await personalizePlan(s)).status).toBe("kept");
    expect(s.save).not.toHaveBeenCalled();
  });

  // GeneratedPlan.cached: a plan written earlier must not be called new (D12).
  it("saves a cached demo plan without calling it new", async () => {
    const s = steps({
      generate: vi.fn().mockResolvedValue({ ...coachPlan, cached: true }),
    });
    expect(await personalizePlan(s)).toEqual({
      status: "saved",
      message: CACHED_MESSAGE,
    });
    expect(s.save).toHaveBeenCalledWith(plan);
  });

  it("returns an error state, with no model call, when loading the profile fails", async () => {
    const s = steps({ loadInputs: vi.fn().mockRejectedValue(new Error("db")) });
    expect(await personalizePlan(s)).toEqual({
      status: "error",
      message: UNAVAILABLE_MESSAGE,
    });
    expect(s.claim).not.toHaveBeenCalled();
    expect(s.generate).not.toHaveBeenCalled();
  });

  it("returns an error state, with no model call, when the claim fails", async () => {
    const s = steps({
      claim: vi
        .fn()
        .mockRejectedValue(new Error("Account unavailable for plan requests.")),
    });
    expect(await personalizePlan(s)).toEqual({
      status: "error",
      message: UNAVAILABLE_MESSAGE,
    });
    expect(s.generate).not.toHaveBeenCalled();
  });

  it("reports a failed save without claiming the plan changed", async () => {
    const s = steps({ save: vi.fn().mockRejectedValue(new Error("SQL")) });
    expect(await personalizePlan(s)).toEqual({
      status: "error",
      message: SAVE_FAILED_MESSAGE,
    });
  });
});

// The issue's cases through the real generatePlan, with only the model mocked.
describe("personalizePlan with the real generatePlan", () => {
  const library = ["Pushups", "Bodyweight_Squat", "Crunches", "Plank"].map(
    (id) => ({
      id,
      category: "strength",
      equipment: "body only",
      primaryMuscles: [id === "Pushups" ? "chest" : "quadriceps"],
      secondaryMuscles: [],
    }),
  );
  const profile = {
    daysPerWeek: 1,
    equipment: ["body only"],
    avoidMuscles: [],
  };
  const realSteps = (model: () => Promise<unknown>) =>
    steps({
      loadInputs: vi.fn().mockResolvedValue({ profile, library }),
      generate: vi.fn((p, l) => generatePlan(model, p, l)),
    });

  it("keeps the current plan when the verifier rejects every reply", async () => {
    const s = realSteps(async () => ({ name: "Bad", days: [] }));
    expect((await personalizePlan(s)).status).toBe("kept");
    expect(s.save).not.toHaveBeenCalled();
    await expect(s.generate.mock.results[0]?.value).resolves.toMatchObject({
      source: "DEFAULT",
    });
  });

  it("keeps the current plan when the provider is down", async () => {
    const s = realSteps(async () => {
      throw new ProviderError("HTTP 503", "Groq", HTTP_UNAVAILABLE);
    });
    expect((await personalizePlan(s)).status).toBe("kept");
    expect(s.save).not.toHaveBeenCalled();
    await expect(s.generate.mock.results[0]?.value).resolves.toMatchObject({
      source: "DEFAULT",
    });
  });
});
