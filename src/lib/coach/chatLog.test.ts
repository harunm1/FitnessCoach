// One coachLog record per chat model call (#41, review of 11 Nov), and a bug while
// building the prompt is thrown, not reported as "the coach can't answer".
import { describe, expect, it, vi } from "vitest";
import {
  CHAT_PROMPT_VERSION,
  UNAVAILABLE_REPLY,
  coachReply,
  type CoachContext,
} from "./chat";
import type { CoachRecord } from "./coachLog";
import { REPLIES } from "./guardrails";
import {
  ProviderError,
  type CoachChatModel,
  type ProviderEvent,
} from "./providers";

const ctx: CoachContext = {
  goal: "MUSCLE",
  level: "BEGINNER",
  daysPerWeek: 3,
  equipment: ["dumbbell"],
  injuries: null,
  sessionLines: ["Dumbbell bench press 3 x 10"],
};
const QUESTION = "can I go heavier on bench?";
const SERVED: ProviderEvent = {
  provider: "Groq",
  action: "served",
  model: "groq-model",
};

// A clock that moves STEP_MS between the start and the end of the call.
const STEP_MS = 250;
function steppingClock() {
  let t = 1_000;
  return () => (t += STEP_MS);
}

function logged(events: ProviderEvent[] = [SERVED]) {
  const records: CoachRecord[] = [];
  return {
    records,
    options: {
      log: (r: CoachRecord) => {
        records.push(r);
      },
      takeProviderEvents: () => events,
      now: steppingClock(),
    },
  };
}

describe("coachReply records each model call", () => {
  it("writes one chat record for an answered turn", async () => {
    const model = vi.fn<CoachChatModel>().mockResolvedValue("Add 2 kg.");
    const { records, options } = logged();
    const turn = await coachReply(model, ctx, [], QUESTION, undefined, options);
    expect(turn).toEqual({ reply: "Add 2 kg.", source: "COACH" });
    expect(records).toEqual([
      {
        kind: "chat",
        promptVersion: CHAT_PROMPT_VERSION,
        attempt: 1,
        latencyMs: STEP_MS,
        outcome: "ok",
        provider: "Groq",
        model: "groq-model",
        providerEvents: [],
      },
    ]);
  });

  it("records a switch to the other provider", async () => {
    const model = vi.fn<CoachChatModel>().mockResolvedValue("Add 2 kg.");
    const { records, options } = logged([
      { provider: "Groq", action: "fallback", status: 429 },
      { provider: "Gemini", action: "served", model: "gemini-model" },
    ]);
    await coachReply(model, ctx, [], QUESTION, undefined, options);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      outcome: "switched",
      provider: "Gemini",
      model: "gemini-model",
      providerEvents: [{ provider: "Groq", action: "fallback", status: 429 }],
    });
  });

  it("records a failed call as an error and still answers UNAVAILABLE", async () => {
    const model = vi
      .fn<CoachChatModel>()
      .mockRejectedValue(
        new ProviderError("Groq returned HTTP 503", "Groq", 503),
      );
    const { records, options } = logged([]);
    const turn = await coachReply(model, ctx, [], QUESTION, undefined, options);
    expect(turn).toEqual({ reply: UNAVAILABLE_REPLY, source: "UNAVAILABLE" });
    expect(records).toEqual([
      {
        kind: "chat",
        promptVersion: CHAT_PROMPT_VERSION,
        attempt: 1,
        latencyMs: STEP_MS,
        outcome: "error",
        providerEvents: [],
        error: "Groq returned HTTP 503",
      },
    ]);
  });

  it("records a reply the reply check replaced as rejected", async () => {
    const model = vi
      .fn<CoachChatModel>()
      .mockResolvedValue("That sounds like tendinitis. Rest it.");
    const { records, options } = logged();
    const turn = await coachReply(
      model,
      ctx,
      [],
      "my elbow feels tight after curls",
      undefined,
      options,
    );
    expect(turn).toEqual({ reply: REPLIES.NO_DIAGNOSIS, source: "GUARDRAIL" });
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      outcome: "rejected",
      provider: "Groq",
      problems: ["reply check: NO_DIAGNOSIS"],
    });
  });

  it("writes nothing when a guardrail answers without a model call", async () => {
    const model = vi.fn<CoachChatModel>();
    const { records, options } = logged();
    await coachReply(
      model,
      ctx,
      [],
      "sharp pain in my knee on squats",
      undefined,
      options,
    );
    expect(model).not.toHaveBeenCalled();
    expect(records).toEqual([]);
  });

  it("keeps the user's text and the reply out of the record", async () => {
    const reply = "Keep the bar path straight over mid-foot.";
    const model = vi.fn<CoachChatModel>().mockResolvedValue(reply);
    const { records, options } = logged();
    const text = "my bench bar path drifts toward my face";
    await coachReply(model, ctx, [], text, undefined, options);
    const record = JSON.stringify(records);
    expect(record).not.toContain(text);
    expect(record).not.toContain(reply);
    expect(record).not.toContain("bench press");
  });

  it("records only the error's name when a provider reply would not parse", async () => {
    // A JSON parse error quotes the start of the body it could not read.
    const model = vi
      .fn<CoachChatModel>()
      .mockRejectedValue(
        new SyntaxError(
          `Unexpected token '<', "<html>my knee hurts"... is not valid JSON`,
        ),
      );
    const { records, options } = logged([]);
    const turn = await coachReply(model, ctx, [], QUESTION, undefined, options);
    expect(turn.source).toBe("UNAVAILABLE");
    expect(records).toHaveLength(1);
    expect(records[0].error).toBe("SyntaxError");
    expect(JSON.stringify(records)).not.toContain("knee");
  });

  it("keeps a provider error's own fixed message in the record", async () => {
    const model = vi
      .fn<CoachChatModel>()
      .mockRejectedValue(new ProviderError("Groq returned 503", "Groq", 503));
    const { records, options } = logged([]);
    await coachReply(model, ctx, [], QUESTION, undefined, options);
    expect(records[0].error).toBe("Groq returned 503");
  });

  it("answers even when the sink throws", async () => {
    const model = vi.fn<CoachChatModel>().mockResolvedValue("Add 2 kg.");
    const turn = await coachReply(model, ctx, [], QUESTION, undefined, {
      log: () => {
        throw new Error("sink down");
      },
    });
    expect(turn).toEqual({ reply: "Add 2 kg.", source: "COACH" });
  });
});

describe("coachReply programming errors", () => {
  it("throws a bug in building the prompt instead of answering UNAVAILABLE", async () => {
    const model = vi.fn<CoachChatModel>();
    const broken = {
      ...ctx,
      sessionLines: undefined,
    } as unknown as CoachContext;
    await expect(coachReply(model, broken, [], QUESTION)).rejects.toThrow(
      TypeError,
    );
    expect(model).not.toHaveBeenCalled();
  });
});
