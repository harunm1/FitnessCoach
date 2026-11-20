// A chat call's record carries the provider's token counts, and a null guardrail
// verdict until the chat path passes the screening result on (#41, after #56).
import { describe, expect, it } from "vitest";
import { CHAT_PROMPT_VERSION, recordChatCall } from "./chat";
import type { CoachRecord } from "./coachLog";
import type { ProviderEvent } from "./providers";

const INPUT_TOKENS = 700;
const OUTPUT_TOKENS = 90;
const LATENCY_MS = 40;

function collect() {
  const records: CoachRecord[] = [];
  return { records, log: (r: CoachRecord) => void records.push(r) };
}

describe("recordChatCall record fields", () => {
  it("carries the token counts of the call that answered", async () => {
    const { records, log } = collect();
    const events: ProviderEvent[] = [
      { provider: "Groq", action: "served", model: "m" },
      {
        provider: "Groq",
        action: "usage",
        inputTokens: INPUT_TOKENS,
        outputTokens: OUTPUT_TOKENS,
      },
    ];

    await recordChatCall(
      { log, takeProviderEvents: () => events },
      LATENCY_MS,
      { ok: true },
    );

    expect(records[0]).toMatchObject({
      kind: "chat",
      promptVersion: CHAT_PROMPT_VERSION,
      outcome: "ok",
      inputTokens: INPUT_TOKENS,
      outputTokens: OUTPUT_TOKENS,
      guardrailVerdict: null,
    });
    expect(records[0].providerEvents).toEqual([]);
  });

  it("records null counts when the provider sent none", async () => {
    const { records, log } = collect();

    await recordChatCall({ log }, LATENCY_MS, { error: "no text" });

    expect(records[0]).toMatchObject({
      outcome: "error",
      inputTokens: null,
      outputTokens: null,
      guardrailVerdict: null,
    });
  });
});
