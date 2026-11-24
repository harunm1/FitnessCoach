"use server";

// Server Action for "Personalize with the coach" (#58). Order, as agreed in #51:
// authentication, then input checks, then the #107 plan-request claim, then the model.
// A claim is spent even if the provider fails (plan-rate-limit.ts).
import { revalidatePath } from "next/cache";
import { requireTier } from "@/lib/auth/access";
import { claimCoachPlanRequest } from "@/lib/auth/plan-rate-limit";
import { PLAN_TIERS } from "@/lib/auth/tier";
import { providerEventCollector } from "@/lib/coach/coachLog";
import { prismaCoachSink } from "@/lib/coach/coachSink";
import { demoPlans } from "@/lib/coach/demoPlans";
import { generatePlan } from "@/lib/coach/generatePlan";
import {
  UNAVAILABLE_MESSAGE,
  personalizePlan,
  type PersonalizeState,
} from "@/lib/coach/personalize";
import { loadPersonalizeInputs } from "@/lib/coach/personalizeInputs";
import { coachModel } from "@/lib/coach/providers";
import { saveWeek } from "@/lib/coach/saveWeek";
import { prisma } from "@/lib/prisma";
import { TIER_MESSAGE } from "./copy";

const FORBIDDEN = 403;

// useActionState passes the previous state; it is not needed, so it is not declared.
export async function personalizeWithCoach(): Promise<PersonalizeState> {
  // Every tier can request a plan (#51); only the coach chat is a pro feature. A database
  // failure in the access lookup is an error state, with no claim and no model call.
  let account: Awaited<ReturnType<typeof requireTier>>;
  try {
    account = await requireTier(PLAN_TIERS);
  } catch {
    return { status: "error", message: UNAVAILABLE_MESSAGE };
  }
  if (!account.ok) {
    return {
      status: "error",
      message: account.status === FORBIDDEN ? TIER_MESSAGE : account.message,
    };
  }
  const userId = account.user.id;
  const events = providerEventCollector();

  const state = await personalizePlan({
    loadInputs: () => loadPersonalizeInputs(prisma, userId),
    claim: () => claimCoachPlanRequest(prisma, userId),
    // coachModel throws when no provider key is set; personalizePlan keeps the plan.
    generate: (profile, library) =>
      generatePlan(
        coachModel(process.env, { onEvent: events.onEvent }),
        profile,
        library,
        {
          log: prismaCoachSink(userId),
          takeProviderEvents: events.take,
          demoPlans: demoPlans(),
        },
      ),
    save: async (plan) => {
      await saveWeek(
        prisma,
        userId,
        {
          name: plan.name,
          days: plan.days.map((day) => ({ kind: "STRENGTH" as const, ...day })),
        },
        "COACH",
      );
    },
  });
  if (state.status === "saved") revalidatePath("/session");
  return state;
}
