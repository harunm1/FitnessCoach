// "Personalize with the coach" (#58): the order of steps and what the user is told.
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  KEPT_MESSAGE,
  NO_GYM_PROFILE_MESSAGE,
  SAVE_FAILED_MESSAGE,
  SAVED_MESSAGE,
  personalizePlan,
  type PersonalizeSteps,
} from "./personalize";
import type { GeneratedPlan } from "./generatePlan";

const COOLDOWN_SECONDS = 42;
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

  it("saves a cached demo plan as a coach plan", async () => {
    const s = steps({
      generate: vi.fn().mockResolvedValue({ ...coachPlan, cached: true }),
    });
    expect((await personalizePlan(s)).status).toBe("saved");
    expect(s.save).toHaveBeenCalledWith(plan);
  });

  it("reports a failed save without claiming the plan changed", async () => {
    const s = steps({ save: vi.fn().mockRejectedValue(new Error("SQL")) });
    expect(await personalizePlan(s)).toEqual({
      status: "error",
      message: SAVE_FAILED_MESSAGE,
    });
  });
});
