// One record per model call (#41), so a bad plan or a slow demo can be traced to the
// call that produced it, and the ten-profile eval (#19) can report fallback rates.
// The sink is passed in: tests collect records in memory; the app will write them
// to a CoachEvent table once the schema has one (#41, after #44).
import type { ProviderEvent } from "./providers";

// Bump when the plan prompt's wording or shape changes, so records from different
// prompts are never compared as if they were the same experiment.
export const PLAN_PROMPT_VERSION = "plan-v2";

export type CoachOutcome =
  | "ok" // first try, verified
  | "retried" // verified after a provider retry or a regeneration
  | "switched" // verified after moving to the other provider
  | "rejected" // the reply failed the verifier; problems listed
  | "error" // no usable reply (transport failure or not JSON)
  | "rule_based"; // both attempts failed; the user got the default plan

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
  outputTokens: number | null; // reply tokens, thinking included where the provider bills it
  guardrailVerdict: string | null; // the #43 verdict name for the user's message; null when none was screened
  problems?: string[];
  raw?: unknown; // the model's reply as parsed, kept beside the plan we saved
  error?: string;
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
