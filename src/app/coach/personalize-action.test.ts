// The "Personalize with the coach" Server Action (#58): authentication first, then the
// #107 plan-request claim before any model call, then save and refresh.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNAVAILABLE_MESSAGE } from "@/lib/coach/personalize";
import { TIER_MESSAGE } from "./copy";

const mocks = vi.hoisted(() => ({
  requireTier: vi.fn(),
  claim: vi.fn(),
  generatePlan: vi.fn(),
  coachModel: vi.fn(),
  saveWeek: vi.fn(),
  loadInputs: vi.fn(),
  revalidatePath: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/prisma", () => ({ prisma: { tag: "db" } }));
vi.mock("@/lib/auth/access", () => ({ requireTier: mocks.requireTier }));
vi.mock("@/lib/auth/plan-rate-limit", () => ({
  claimCoachPlanRequest: mocks.claim,
}));
vi.mock("@/lib/coach/generatePlan", () => ({
  generatePlan: mocks.generatePlan,
}));
vi.mock("@/lib/coach/providers", () => ({ coachModel: mocks.coachModel }));
vi.mock("@/lib/coach/coachSink", () => ({ prismaCoachSink: () => vi.fn() }));
vi.mock("@/lib/coach/demoPlans", () => ({ demoPlans: () => undefined }));
vi.mock("@/lib/coach/saveWeek", () => ({ saveWeek: mocks.saveWeek }));
vi.mock("@/lib/coach/personalizeInputs", () => ({
  loadPersonalizeInputs: mocks.loadInputs,
}));
import { personalizeWithCoach } from "./personalize-action";

const UNAUTHORISED = 401;
const FORBIDDEN = 403;
const COOLDOWN_SECONDS = 30;
const slot = { sets: 3, reps: 10, restSeconds: 90, rpe: 7 } as const;
const day = {
  name: "Day 1",
  exercises: [{ exerciseId: "Pushups", ...slot }],
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireTier.mockResolvedValue({ ok: true, user: { id: "owner" } });
  mocks.loadInputs.mockResolvedValue({
    profile: { daysPerWeek: 1, equipment: ["body only"], avoidMuscles: [] },
    library: [],
  });
  mocks.claim.mockResolvedValue({ allowed: true, retryAfterSeconds: 0 });
  mocks.generatePlan.mockResolvedValue({
    plan: { name: "Coach plan", days: [day] },
    source: "COACH",
    attempts: 1,
    cached: false,
  });
  mocks.saveWeek.mockResolvedValue({ planId: 1 });
});

describe("personalizeWithCoach", () => {
  it.each([
    [UNAUTHORISED, "Sign in again."],
    [FORBIDDEN, TIER_MESSAGE],
  ])(
    "stops at authentication (%i) before the claim or any model call",
    async (status, message) => {
      mocks.requireTier.mockResolvedValue({
        ok: false,
        status,
        message: "Sign in again.",
      });
      expect(await personalizeWithCoach()).toEqual({
        status: "error",
        message,
      });
      expect(mocks.claim).not.toHaveBeenCalled();
      expect(mocks.generatePlan).not.toHaveBeenCalled();
    },
  );

  // #51: every tier can request a plan; only the coach chat is a pro feature. An expired
  // trial resolves to FREE inside requireTier, so FREE in the list covers it too.
  it("lets every tier request a plan, FREE and an expired TRIAL included (#51)", async () => {
    await personalizeWithCoach();
    const [allowed] = mocks.requireTier.mock.calls[0] ?? [];
    expect(allowed).toEqual(
      expect.arrayContaining(["FREE", "TRIAL", "PRO", "ADMIN"]),
    );
  });

  it("returns a generic error, with no claim or model call, when the access lookup throws", async () => {
    mocks.requireTier.mockRejectedValue(new Error("connection refused: db"));
    expect(await personalizeWithCoach()).toEqual({
      status: "error",
      message: UNAVAILABLE_MESSAGE,
    });
    expect(mocks.claim).not.toHaveBeenCalled();
    expect(mocks.coachModel).not.toHaveBeenCalled();
    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("claims for the session user before the model, saves a coach plan as strength days and refreshes the session screen", async () => {
    const state = await personalizeWithCoach();
    expect(state.status).toBe("saved");
    expect(mocks.loadInputs).toHaveBeenCalledWith({ tag: "db" }, "owner");
    expect(mocks.claim).toHaveBeenCalledWith({ tag: "db" }, "owner");
    expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.coachModel.mock.invocationCallOrder[0],
    );
    expect(mocks.claim.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.generatePlan.mock.invocationCallOrder[0],
    );
    expect(mocks.saveWeek).toHaveBeenCalledWith(
      { tag: "db" },
      "owner",
      { name: "Coach plan", days: [{ kind: "STRENGTH", ...day }] },
      "COACH",
    );
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/session");
  });

  it("returns the cooldown and does not refresh when the claim is refused", async () => {
    mocks.claim.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: COOLDOWN_SECONDS,
      message: "Please wait 30 seconds before requesting another plan.",
    });
    expect(await personalizeWithCoach()).toEqual({
      status: "error",
      message: "Please wait 30 seconds before requesting another plan.",
      retryAfterSeconds: COOLDOWN_SECONDS,
    });
    expect(mocks.generatePlan).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("keeps the current plan when provider keys are missing", async () => {
    mocks.coachModel.mockImplementationOnce(() => {
      throw new Error("GROQ_API_KEY is not set");
    });
    expect((await personalizeWithCoach()).status).toBe("kept");
    expect(mocks.saveWeek).not.toHaveBeenCalled();
  });
});
