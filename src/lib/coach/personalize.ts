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
export const CACHED_MESSAGE =
  "Here is a coach plan written earlier that passes every check for your profile.";
export const KEPT_MESSAGE =
  "The coach could not give you a new plan that passed the checks right now, so your current plan stays.";
export const UNAVAILABLE_MESSAGE =
  "Personalize with the coach is not available right now. Your current plan stays; try again in a minute.";
export const NO_GYM_PROFILE_MESSAGE =
  "Personalize with the coach works for gym plans. Finish the quiz with the gym option first.";
export const SAVE_FAILED_MESSAGE =
  "The new plan could not be saved, so your current plan stays. Try again in a minute.";

export type PersonalizeInputs = {
  profile: VerifyProfile;
  library: CategorisedExercise[];
};

export type PersonalizeSteps = {
  // Null when there is no gym profile to plan for (input validation).
  loadInputs: () => Promise<PersonalizeInputs | null>;
  claim: () => Promise<PlanRequestReservation>;
  generate: (
    profile: VerifyProfile,
    library: CategorisedExercise[],
  ) => Promise<GeneratedPlan>;
  save: (plan: PlanInput) => Promise<void>;
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
  let inputs: PersonalizeInputs | null;
  let reservation: PlanRequestReservation;
  try {
    inputs = await steps.loadInputs();
    if (!inputs) return { status: "error", message: NO_GYM_PROFILE_MESSAGE };
    reservation = await steps.claim();
  } catch {
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
  } catch {
    return { status: "kept", message: KEPT_MESSAGE };
  }
  // generatePlan falls back to the rule-based plan when the model fails or the
  // verifier rejects every reply; the user already has one, so nothing is saved.
  if (generated.source !== "COACH") {
    return { status: "kept", message: KEPT_MESSAGE };
  }

  try {
    await steps.save(generated.plan);
  } catch {
    return { status: "error", message: SAVE_FAILED_MESSAGE };
  }
  return {
    status: "saved",
    message: generated.cached ? CACHED_MESSAGE : SAVED_MESSAGE,
  };
}
