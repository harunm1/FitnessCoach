// The streamed chat turn writes one coachLog record per model call through CoachSink,
// as coachReply does (#41, #56 after main's 9da6c3e and fbfa413).
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHAT_PROMPT_VERSION,
  UNAVAILABLE_REPLY,
  type CoachContext,
} from "./chat";
import { coachReplyStream } from "./chatStream";
import type { CoachRecord } from "./coachLog";
import { REPLIES } from "./guardrails";
import {
  ProviderError,
  coachChatStream,
  groqChatStream,
  servedStream,
  withStreamFallback,
  type ChatStream,
  type ProviderEvent,
} from "./providers";

const DAYS_PER_WEEK = 3;
const RATE_LIMITED = 429;
const UNAVAILABLE = 503;
const HTTP_OK = 200;

const ctx: CoachContext = {
  goal: "MUSCLE",
  level: "BEGINNER",
  daysPerWeek: DAYS_PER_WEEK,
  equipment: ["dumbbell"],
  injuries: null,
  sessionLines: ["Goblet squat 3 x 10"],
};
const QUESTION = "what pace for my easy run?";
const SERVED: ProviderEvent = {
  provider: "Groq",
  action: "served",
  model: "groq-model",
};

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

const streamOf = (...pieces: string[]): ChatStream =>
  async function* () {
    for (const p of pieces) yield p;
  };

async function collect(it: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const s of it) out.push(s);
  return out;
}

const base = {
  kind: "chat",
  promptVersion: CHAT_PROMPT_VERSION,
  attempt: 1,
  latencyMs: STEP_MS,
};

describe("coachReplyStream records each model call", () => {
  it("writes one ok record for a streamed reply", async () => {
    const { records, options } = logged();
    const out = await collect(
      coachReplyStream(
        streamOf("Easy. ", "Talk pace."),
        ctx,
        [],
        QUESTION,
        undefined,
        options,
      ),
    );
    expect(out).toEqual(["Easy. ", "Talk pace."]);
    expect(records).toEqual([
      {
        ...base,
        outcome: "ok",
        provider: "Groq",
        model: "groq-model",
        providerEvents: [],
      },
    ]);
  });

  it("records a switch to the other provider", async () => {
    const { records, options } = logged([
      { provider: "Groq", action: "fallback", status: RATE_LIMITED },
      { provider: "Gemini", action: "served", model: "gemini-model" },
    ]);
    await collect(
      coachReplyStream(
        streamOf("Easy."),
        ctx,
        [],
        QUESTION,
        undefined,
        options,
      ),
    );
    expect(records).toEqual([
      {
        ...base,
        outcome: "switched",
        provider: "Gemini",
        model: "gemini-model",
        providerEvents: [
          { provider: "Groq", action: "fallback", status: RATE_LIMITED },
        ],
      },
    ]);
  });

  it("records a stream the reply check stopped as rejected", async () => {
    const { records, options } = logged();
    await collect(
      coachReplyStream(
        streamOf("Ease off. ", "That sounds like tendinitis. "),
        ctx,
        [],
        "my elbow feels tight after curls",
        undefined,
        options,
      ),
    );
    expect(records).toEqual([
      {
        ...base,
        outcome: "rejected",
        provider: "Groq",
        model: "groq-model",
        providerEvents: [],
        problems: ["reply check: NO_DIAGNOSIS"],
      },
    ]);
  });

  it("records a provider failure by the provider's fixed message", async () => {
    const { records, options } = logged([]);
    const failing: ChatStream = async function* () {
      throw new ProviderError("Groq returned HTTP 503", "Groq", UNAVAILABLE);
    };
    const out = await collect(
      coachReplyStream(failing, ctx, [], QUESTION, undefined, options),
    );
    expect(out).toEqual([UNAVAILABLE_REPLY]);
    expect(records).toEqual([
      {
        ...base,
        outcome: "error",
        providerEvents: [],
        error: "Groq returned HTTP 503",
      },
    ]);
  });

  it("records any other error by its name only, never its message", async () => {
    const { records, options } = logged([]);
    const failing: ChatStream = async function* () {
      throw new SyntaxError("Unexpected token in 'my knee hurts'");
    };
    await collect(
      coachReplyStream(failing, ctx, [], QUESTION, undefined, options),
    );
    expect(records[0].error).toBe("SyntaxError");
    // The user's word "knee" from the thrown message must not reach a record.
    expect(JSON.stringify(records)).not.toContain("knee");
  });

  it("records a stream with no text as an error", async () => {
    const { records, options } = logged();
    const out = await collect(
      coachReplyStream(streamOf("  "), ctx, [], QUESTION, undefined, options),
    );
    expect(out).toEqual([UNAVAILABLE_REPLY]);
    expect(records).toEqual([
      {
        ...base,
        outcome: "error",
        provider: "Groq",
        model: "groq-model",
        providerEvents: [],
        error: "stream had no text",
      },
    ]);
  });

  it("writes one record when the reader stops early", async () => {
    const { records, options } = logged();
    const pieces = coachReplyStream(
      streamOf("One. ", "Two. ", "Three."),
      ctx,
      [],
      QUESTION,
      undefined,
      options,
    )[Symbol.asyncIterator]();
    expect(await pieces.next()).toEqual({ value: "One. ", done: false });
    await pieces.return?.(undefined);
    expect(records).toHaveLength(1);
    expect(records[0]).toMatchObject({
      outcome: "error",
      error: "stream stopped by reader",
    });
  });

  it("writes no record for a fixed reply", async () => {
    const { records, options } = logged();
    const stream = vi.fn(streamOf("anything"));
    const out = await collect(
      coachReplyStream(
        stream,
        ctx,
        [],
        "sharp pain in my knee",
        undefined,
        options,
      ),
    );
    expect(out).toEqual([REPLIES.PAIN_STOP]);
    expect(records).toEqual([]);
  });
});

describe("served events on streams", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("names the provider that sent the first piece", async () => {
    const events: ProviderEvent[] = [];
    const onEvent = (e: ProviderEvent) => events.push(e);
    const down: ChatStream = async function* () {
      throw new ProviderError("Groq returned HTTP 429", "Groq", RATE_LIMITED);
    };
    const out = await collect(
      withStreamFallback(
        servedStream(down, "Groq", "groq-model", onEvent),
        servedStream(streamOf("Hi.", " Again."), "Gemini", "g-model", onEvent),
        onEvent,
      )([]),
    );
    expect(out).toEqual(["Hi.", " Again."]);
    expect(events).toEqual([
      { provider: "Groq", action: "fallback", status: RATE_LIMITED },
      { provider: "Gemini", action: "served", model: "g-model" },
    ]);
  });

  it("moves to the other provider when a stream ends with no text", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("data: [DONE]\n\n", { status: HTTP_OK })),
    );
    const out = await collect(
      withStreamFallback(groqChatStream("k"), streamOf("From Gemini."))([]),
    );
    expect(out).toEqual(["From Gemini."]);
  });

  it("coachChatStream reports the configured model as served", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"Hello."}}]}\n\n' +
      "data: [DONE]\n\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(sse, { status: HTTP_OK })),
    );
    const events: ProviderEvent[] = [];
    const stream = coachChatStream(
      { GROQ_API_KEY: "k", GROQ_MODEL: "groq-x" },
      (e) => events.push(e),
    );
    expect(await collect(stream([]))).toEqual(["Hello."]);
    expect(events).toEqual([
      { provider: "Groq", action: "served", model: "groq-x" },
    ]);
  });
});
