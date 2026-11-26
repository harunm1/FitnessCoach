// The model that adapts a program (D38), and how often a user may ask for it.
import type { PlanModel } from "@/lib/coach/generatePlan";
import { coachModel } from "@/lib/coach/providers";
import { createAttemptLimiter } from "@/lib/coach/attemptLimit";
import { ADAPT_TIMEOUT_MS } from "./adapt";

type Env = Record<string, string | undefined>;

// Our choice: a user tries a few templates in a minute; more than that is a loop.
export const ADAPT_LIMITS = { perMinute: 3, perDay: 30 } as const;

export const LIMIT_NOTE =
  "You have asked the coach to adapt several programs in a short time, so here is this template as written, fitted to your equipment. Try the coach again in a minute.";

const limiter = createAttemptLimiter(ADAPT_LIMITS);

// Records an attempt; false when the user is over the limit (no model call then).
export const takeAdaptAttempt = (userId: string): boolean =>
  limiter.take(userId) === null;

// A model call that always fails, so the adapter serves the template.
export const unavailableModel =
  (error: unknown): PlanModel =>
  async () => {
    throw error;
  };

// The coach's providers with no retries and the adapt timeout. PROGRAM_MODEL_STUB is a
// fixed JSON reply for the browser test (playwright.config.ts), which has no provider
// key; it is ignored on Vercel, so it cannot change a deployed app. No key, or a bad
// COACH_PROVIDER, makes the call fail, and the adapter falls back to the template.
export function programModel(env: Env = process.env): PlanModel {
  const stub = env.PROGRAM_MODEL_STUB;
  if (stub && !env.VERCEL) return async () => JSON.parse(stub);
  try {
    return coachModel(env, { retries: 0, timeoutMs: ADAPT_TIMEOUT_MS });
  } catch (error) {
    return unavailableModel(error);
  }
}
