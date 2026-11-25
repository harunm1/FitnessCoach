// "Personalize with the coach" (#58, 3 Nov design review): onboarding keeps the
// rule-based plan; this runs the coach on demand and saves its plan only if the
// verifier passed it. The steps are passed in, so the order (input checks, then the
// request claim from #107, then the model, then the save) is tested without a database.
// Authentication happens before this, in the Server Action.
import type { PlanRequestReservation } from "@/lib/auth/plan-rate-limit";
import type { GeneratedPlan } from "./generatePlan";
import type { PlanInput } from "./schema";
import type { CategorisedExercise, VerifyProfile } from "./verify";

export const SAVED_MESSAGE =
  "The coach wrote a new plan for you and it passed every check.";
// A plan written earlier (demo mode, D12) is a coach plan but must not be called new.
// The sentence is D12's own ("How the screen says so" in docs/ARCHITECTURE.md).
export const CACHED_MESSAGE =
  "The coach is busy right now, so here is a plan it wrote earlier for a profile like yours.";
// The request is claimed before the model runs and stays spent (plan-rate-limit.ts), so
// the user waits a minute before the next try.
export const KEPT_MESSAGE =
  "The coach could not give you a new plan that passed the checks right now, so your current plan stays. You can try again in a minute.";
export const UNAVAILABLE_MESSAGE =
  "Personalize with the coach is not available right now. Your current plan stays; try again in a minute.";
export const NO_GYM_PROFILE_MESSAGE =
  "Personalize with the coach works for gym plans. Finish the quiz with the gym option first.";
export const NOT_GYM_MESSAGE =
  "Personalize with the coach writes gym plans only, so your current week stays as it is.";
export const SAVE_FAILED_MESSAGE =
  "The new plan could not be saved, so your current plan stays. Try again in a minute.";

export type PersonalizeInputs = {
  profile: VerifyProfile;
  library: CategorisedExercise[];
};

export type PersonalizeSteps = {
  // Input validation: why there is nothing to plan for, or the inputs.
  loadInputs: () => Promise<PersonalizeInputs | "no-profile" | "not-gym">;
  claim: () => Promise<PlanRequestReservation>;
  generate: (
    profile: VerifyProfile,
    library: CategorisedExercise[],
  ) => Promise<GeneratedPlan>;
  save: (plan: PlanInput) => Promise<void>;
  // Called with the step name for every failure the user is not shown (server log).
  onError?: (step: string, error: unknown) => void;
};

export type PersonalizeState =
  | { status: "idle" }
  | { status: "saved"; message: string }
  | { status: "kept"; message: string }
  | { status: "error"; message: string; retryAfterSeconds?: number };

export async function personalizePlan(
  steps: PersonalizeSteps,
): Promise<PersonalizeState> {
  // A database failure before the model is an error state, not a crashed action.
  let inputs: Awaited<ReturnType<PersonalizeSteps["loadInputs"]>>;
  let reservation: PlanRequestReservation;
  let step = "load";
  try {
    step = "load";
    inputs = await steps.loadInputs();
    if (inputs === "no-profile") {
      return { status: "error", message: NO_GYM_PROFILE_MESSAGE };
    }
    if (inputs === "not-gym") {
      return { status: "error", message: NOT_GYM_MESSAGE };
    }
    step = "claim";
    reservation = await steps.claim();
  } catch (error) {
    steps.onError?.(step, error);
    return { status: "error", message: UNAVAILABLE_MESSAGE };
  }
  if (!reservation.allowed) {
    return {
      status: "error",
      message: reservation.message,
      retryAfterSeconds: reservation.retryAfterSeconds,
    };
  }

  let generated: GeneratedPlan;
  try {
    generated = await steps.generate(inputs.profile, inputs.library);
  } catch (error) {
    steps.onError?.("generate", error);
    return { status: "kept", message: KEPT_MESSAGE };
  }
  // generatePlan falls back to the rule-based plan when the model fails or the
  // verifier rejects every reply; the user already has one, so nothing is saved.
  if (generated.source !== "COACH") {
    return { status: "kept", message: KEPT_MESSAGE };
  }

  try {
    await steps.save(generated.plan);
  } catch (error) {
    steps.onError?.("save", error);
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }
  return {
    status: "saved",
    message: generated.cached ? CACHED_MESSAGE : SAVED_MESSAGE,
  };
}
