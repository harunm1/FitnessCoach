// "Personalize with the coach" (#58): the order of steps and what the user is told.
import { describe, expect, it, vi, type Mock } from "vitest";
import {
  CACHED_MESSAGE,
  KEPT_MESSAGE,
  NOT_GYM_MESSAGE,
  NO_GYM_PROFILE_MESSAGE,
  SAVE_FAILED_MESSAGE,
  SAVED_MESSAGE,
  UNAVAILABLE_MESSAGE,
  personalizePlan,
  type PersonalizeSteps,
} from "./personalize";
import { generatePlan, type GeneratedPlan } from "./generatePlan";
import { loadPersonalizeInputs } from "./personalizeInputs";
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

type MockedStep = Exclude<keyof PersonalizeSteps, "onError">;
type StepMocks = { [K in MockedStep]: Mock<PersonalizeSteps[K]> };

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
    const s = steps({ loadInputs: vi.fn().mockResolvedValue("no-profile") });
    expect(await personalizePlan(s)).toEqual({
      status: "error",
      message: NO_GYM_PROFILE_MESSAGE,
    });
    expect(s.claim).not.toHaveBeenCalled();
    expect(s.generate).not.toHaveBeenCalled();
  });

  // A runner who finished the quiz must not be told to redo it: that would replace their
  // running week (verifier finding on #127).
  it("tells a running or hybrid user the coach writes gym plans and their week stays", async () => {
    const s = steps({ loadInputs: vi.fn().mockResolvedValue("not-gym") });
    const state = await personalizePlan(s);
    expect(state).toEqual({ status: "error", message: NOT_GYM_MESSAGE });
    expect(NOT_GYM_MESSAGE).not.toContain("Finish the quiz");
    expect(s.claim).not.toHaveBeenCalled();
    expect(s.generate).not.toHaveBeenCalled();
  });

  it("reports each swallowed failure to onError with its step, so it reaches the server log", async () => {
    const boom = new Error("db down");
    const onError = vi.fn();
    await personalizePlan({
      ...steps({ claim: vi.fn().mockRejectedValue(boom) }),
      onError,
    });
    await personalizePlan({
      ...steps({ generate: vi.fn().mockRejectedValue(boom) }),
      onError,
    });
    await personalizePlan({
      ...steps({ save: vi.fn().mockRejectedValue(boom) }),
      onError,
    });
    expect(onError.mock.calls).toEqual([
      ["claim", boom],
      ["generate", boom],
      ["save", boom],
    ]);
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

// What the user is told, in the words the design notes give (D12 and #51).
describe("personalize messages", () => {
  // docs/ARCHITECTURE.md, D12 "How the screen says so", is the source of this sentence.
  it("says a cached plan was written earlier, in D12's wording", () => {
    expect(CACHED_MESSAGE).toBe(
      "The coach is busy right now, so here is a plan it wrote earlier for a profile like yours.",
    );
  });

  // The claim is spent even when the provider fails (plan-rate-limit.ts), so the user
  // is told about the one-minute wait instead of hitting the cooldown on a second tap.
  it("tells the user a kept plan costs a one-minute wait before the next try", () => {
    expect(KEPT_MESSAGE).toContain("your current plan stays");
    expect(KEPT_MESSAGE).toContain("minute");
  });
});

// The issue's cases through the real generatePlan, with only the model mocked.
describe("personalizePlan with the real generatePlan", () => {
  const SETS = 3;
  const REPS = 10;
  const REST_SECONDS = 90;
  const RPE = 7;
  const strengthLibrary = ["Pushups", "Bodyweight_Squat", "Crunches", "Plank"];
  const library = strengthLibrary.map((id) => ({
    id,
    name: id.replaceAll("_", " "),
    category: "strength",
    equipment: "body only",
    primaryMuscles: [id === "Pushups" ? "chest" : "quadriceps"],
    secondaryMuscles: [],
  }));
  const profile = {
    daysPerWeek: 1,
    equipment: ["body only"],
    avoidMuscles: [],
  };
  const slot = (exercise: string) => ({
    exercise,
    sets: SETS,
    reps: REPS,
    restSeconds: REST_SECONDS,
    rpe: RPE,
  });
  const reply = (...exercises: string[]) => ({
    name: "Coach plan",
    days: [{ name: "Day 1", exercises: exercises.map(slot) }],
  });
  const realSteps = (model: (prompt: string) => Promise<unknown>) =>
    steps({
      loadInputs: vi.fn().mockResolvedValue({ profile, library }),
      generate: vi.fn((p, l) => generatePlan(model, p, l)),
    });

  // The issue's success case: a valid model reply goes through the real generatePlan,
  // is verified, mapped from names to ids, and reaches the save as a coach plan.
  it("saves a valid model reply, stored by exercise id, and offers the model names not ids", async () => {
    const prompts: string[] = [];
    const s = realSteps(async (prompt) => {
      prompts.push(prompt);
      return reply("Pushups", "Bodyweight Squat");
    });
    expect(await personalizePlan(s)).toEqual({
      status: "saved",
      message: SAVED_MESSAGE,
    });
    const prompt = prompts[0] ?? "";
    expect(prompt).toContain("Bodyweight Squat");
    expect(prompt).not.toContain("Bodyweight_Squat");
    expect(s.save).toHaveBeenCalledTimes(1);
    const saved = s.save.mock.calls[0]?.[0];
    expect(saved?.days[0]?.exercises.map((e) => e.exerciseId)).toEqual([
      "Pushups",
      "Bodyweight_Squat",
    ]);
  });

  // Shubham's reproduction on #127: with the real generator and a mocked model, a plan of
  // cardio and stretching passed verification and reached the save, because the loader
  // offered every category. The real loader now filters, so the verifier rejects it.
  it("keeps the current plan when the model answers with cardio or stretching, through the real loader", async () => {
    const everyCategory = [
      ...library,
      {
        ...library[0],
        id: "Stair_Climb",
        name: "Stair Climb",
        category: "cardio",
      },
      {
        ...library[0],
        id: "Hamstring_Stretch",
        name: "Hamstring Stretch",
        category: "stretching",
      },
    ];
    const database = {
      profile: {
        findUnique: vi.fn().mockResolvedValue({
          trainingMode: "GYM",
          daysPerWeek: 1,
          equipment: [],
          injuries: null,
        }),
      },
      exercise: { findMany: vi.fn().mockResolvedValue(everyCategory) },
    };
    const s = steps({
      loadInputs: vi.fn(() =>
        loadPersonalizeInputs(database as never, "owner"),
      ),
      generate: vi.fn((p, l) =>
        generatePlan(
          async () => reply("Stair Climb", "Hamstring Stretch"),
          p,
          l,
        ),
      ),
    });
    expect((await personalizePlan(s)).status).toBe("kept");
    expect(s.save).not.toHaveBeenCalled();
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
