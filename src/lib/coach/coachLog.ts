// One record per model call (#41), so a bad plan or a slow demo can be traced to the
// call that produced it, and the ten-profile eval (#19) can report fallback rates.
// The sink is passed in: tests collect records in memory; server callers can use
// prismaCoachSink(user.id) to persist records without storing the prompt (#52).
import type { Guard } from "./guardrails";
import type { ProviderEvent } from "./providers";

// Bump when the plan prompt's wording or shape changes, so records from different
// prompts are never compared as if they were the same experiment.
export const PLAN_PROMPT_VERSION = "plan-v3";

export type CoachOutcome =
  | "ok" // first try, verified
  | "retried" // verified after a provider retry or a regeneration
  | "switched" // verified after moving to the other provider
  | "rejected" // the reply failed the plan verifier or the chat reply check; problems listed
  | "error" // no usable reply (transport failure, not JSON, or a chat reply with no text)
  | "rule_based" // both attempts failed; the user got the default plan
  | "cached"; // demo mode: both attempts failed; the user got a pre-generated coach plan (#59)

export type CoachRecord = {
  kind: "plan" | "chat";
  promptVersion: string;
  attempt: number;
  latencyMs: number;
  outcome: CoachOutcome;
  provider?: string; // who answered; absent when no provider replied
  model?: string;
  providerEvents: ProviderEvent[]; // retries and switches during this call
  inputTokens: number | null; // from the provider's response; null when it sent no count
  outputTokens: number | null; // reply tokens as the provider reports them (Gemini: answer plus thinking)
  guardrailVerdict: Guard["action"] | null; // the #43 verdict on the user's message; null when none was screened, as for a plan
  problems?: string[];
  raw?: unknown; // the model's reply as parsed, kept beside the plan we saved
  error?: string;
  cachedProfileId?: string; // on "cached": the eval profile whose plan was served
};

export type CoachSink = (record: CoachRecord) => void | Promise<void>;

// Collects provider retries, switches and the serving model between calls; pass `onEvent` to
// coachModel's options and `take()` empties the list into the next record.
export function providerEventCollector() {
  let events: ProviderEvent[] = [];
  return {
    onEvent: (e: ProviderEvent) => {
      events.push(e);
    },
    take: () => {
      const out = events;
      events = [];
      return out;
    },
  };
}

// The "served" event names the provider and model, and the "usage" event carries the
// token counts of the call that answered (a provider that failed over sent none); the
// rest stay as the call's events.
export function splitServed(events: ProviderEvent[]) {
  const last = events.filter((e) => e.action === "served").at(-1);
  const usage = events.filter((e) => e.action === "usage").at(-1);
  return {
    served: last ? { provider: last.provider, model: last.model } : {},
    tokens: {
      inputTokens: usage?.inputTokens ?? null,
      outputTokens: usage?.outputTokens ?? null,
    },
    providerEvents: events.filter(
      (e) => e.action !== "served" && e.action !== "usage",
    ),
  };
}

// The outcome of a call that produced a usable reply.
export function okOutcome(
  attempt: number,
  events: ProviderEvent[],
): CoachOutcome {
  if (events.some((e) => e.action === "fallback")) return "switched";
  if (attempt > 1 || events.some((e) => e.action === "retry")) return "retried";
  return "ok";
}

// A record must never break the request it describes, so sink failures are swallowed.
export async function writeRecord(
  sink: CoachSink | undefined,
  record: CoachRecord,
) {
  if (!sink) return;
  try {
    await sink(record);
  } catch {
    // logging is best effort
  }
}
