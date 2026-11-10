import { afterEach, describe, expect, it, vi } from "vitest";
import {
  EMPTY_REPLY,
  MAX_HISTORY_MESSAGES,
  MAX_MESSAGE_CHARS,
  TOO_LONG_REPLY,
  UNAVAILABLE_REPLY,
  coachReplyStream,
  type CoachContext,
} from "./chat";
import { REPLIES, type ChatMessage } from "./guardrails";
import type { SafetyClassifier } from "./safetyScreen";
import {
  ProviderError,
  groqChatStream,
  withStreamFallback,
  type ChatStream,
} from "./providers";

const ctx: CoachContext = {
  goal: "MUSCLE",
  level: "BEGINNER",
  daysPerWeek: 3,
  equipment: ["dumbbell"],
  injuries: null,
  sessionLines: ["Goblet squat 3 x 10"],
};

const streamOf = (...pieces: string[]): ChatStream =>
  async function* () {
    for (const p of pieces) yield p;
  };

async function collect(it: AsyncIterable<string>) {
  const out: string[] = [];
  for await (const s of it) out.push(s);
  return out;
}

describe("coachReplyStream", () => {
  it("releases whole sentences as they complete", async () => {
    const out = await collect(
      coachReplyStream(
        streamOf("Keep the ", "weight. Add a ", "rep next set. Rest 90 s"),
        ctx,
        [],
        "how should I progress goblet squats?",
      ),
    );
    expect(out).toEqual([
      "Keep the weight. ",
      "Add a rep next set. ",
      "Rest 90 s",
    ]);
  });

  it("answers pain with the fixed reply and never opens the stream", async () => {
    const stream = vi.fn(streamOf("anything"));
    const out = await collect(
      coachReplyStream(stream, ctx, [], "sharp pain in my knee"),
    );
    expect(out).toEqual([REPLIES.PAIN_STOP]);
    expect(stream).not.toHaveBeenCalled();
  });

  it("stops before a diagnosing sentence is shown", async () => {
    const out = await collect(
      coachReplyStream(
        streamOf(
          "Ease off for today. ",
          "That sounds like tendinitis. ",
          "Rest.",
        ),
        ctx,
        [],
        "my elbow feels tight after curls",
      ),
    );
    expect(out).toEqual([
      "Ease off for today. ",
      "\n\n" + REPLIES.NO_DIAGNOSIS,
    ]);
    expect(out.join("")).not.toMatch(/tendinitis/);
  });

  it("ends with the unavailable line when the provider fails", async () => {
    const failing: ChatStream = async function* () {
      throw new ProviderError("down", "Groq", 503);
    };
    const out = await collect(
      coachReplyStream(failing, ctx, [], "what pace for my easy run?"),
    );
    expect(out).toEqual([UNAVAILABLE_REPLY]);
  });
});

describe("withStreamFallback", () => {
  it("switches providers only before the first piece", async () => {
    const down: ChatStream = async function* () {
      throw new ProviderError("429", "Groq", 429);
    };
    const events: unknown[] = [];
    const out = await collect(
      withStreamFallback(down, streamOf("From Gemini."), (e) => events.push(e))(
        [],
      ),
    );
    expect(out).toEqual(["From Gemini."]);
    expect(events).toEqual([
      { provider: "Groq", action: "fallback", status: 429 },
    ]);
  });

  it("does not start a second reply after text has been shown", async () => {
    const half: ChatStream = async function* () {
      yield "Half a ";
      throw new ProviderError("reset", "Groq");
    };
    const backup = vi.fn(streamOf("other"));
    await expect(
      collect(withStreamFallback(half, backup)([])),
    ).rejects.toThrow();
    expect(backup).not.toHaveBeenCalled();
  });
});

describe("groqChatStream", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("reads server-sent events and stops at [DONE]", async () => {
    const sse =
      'data: {"choices":[{"delta":{"content":"Hello"}}]}\n\n' +
      'data: {"choices":[{"delta":{"content":" there."}}]}\n\n' +
      "data: [DONE]\n\n";
    const fetchMock = vi.fn(async () => new Response(sse, { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const out = await collect(groqChatStream("test-key")([]));
    expect(out).toEqual(["Hello", " there."]);
    const body = JSON.parse(
      (fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
        .body as string,
    );
    expect(body.stream).toBe(true);
  });
});

// Review of 8 Nov on #56, point 1: the streamed turn runs the same preparation as
// coachReply on #53: the layered safety screen, the 1,000-character limit and the last
// 12 history messages, each capped.
const HISTORY_TURNS = 20;
// Every stored turn is longer than the cap, so the cap is what shortens it.
const LONG_TURN_CHARS = MAX_MESSAGE_CHARS + MAX_MESSAGE_CHARS;
const ROLES = ["user", "assistant"] as const;
const OVERSIZED_MESSAGE = "squat ".repeat(MAX_MESSAGE_CHARS);
const HTTP_OK = 200;

describe("coachReplyStream uses the chat turn's checks", () => {
  const benchTurn: ChatMessage[] = [
    { role: "user", content: "can I go heavier on bench press?" },
    {
      role: "assistant",
      content: "Yes: add 2 kg next set if your last rep was smooth.",
    },
  ];

  it("never sends an oversized message to the provider", async () => {
    const stream = vi.fn(streamOf("anything"));
    const out = await collect(
      coachReplyStream(stream, ctx, [], OVERSIZED_MESSAGE),
    );
    expect(out).toEqual([TOO_LONG_REPLY]);
    expect(stream).not.toHaveBeenCalled();
  });

  it("sends only the last 12 history messages, each capped", async () => {
    const stream = vi.fn(streamOf("Fine."));
    const history: ChatMessage[] = Array.from(
      { length: HISTORY_TURNS },
      (_, i) => ({
        role: ROLES[i % ROLES.length],
        content: `turn ${i} `.padEnd(LONG_TURN_CHARS, "x"),
      }),
    );
    await collect(coachReplyStream(stream, ctx, history, "how many sets?"));
    const messages = stream.mock.calls[0][0] as ChatMessage[];
    expect(messages).toHaveLength(1 + MAX_HISTORY_MESSAGES + 1);
    // The oldest turn kept is turn 8 of 0..19: its text starts "turn 8 ".
    expect(
      messages[1].content.startsWith(
        `turn ${HISTORY_TURNS - MAX_HISTORY_MESSAGES} `,
      ),
    ).toBe(true);
    expect(messages.every((m) => m.content.length <= MAX_MESSAGE_CHARS)).toBe(
      true,
    );
  });

  it("answers an empty message without opening the stream", async () => {
    const stream = vi.fn(streamOf("anything"));
    expect(await collect(coachReplyStream(stream, ctx, [], "   "))).toEqual([
      EMPTY_REPLY,
    ]);
    expect(stream).not.toHaveBeenCalled();
  });

  it("gives the crisis reply when the model safety check reads crisis", async () => {
    const stream = vi.fn(streamOf("anything"));
    const classify = vi.fn<SafetyClassifier>().mockResolvedValue("CRISIS");
    const out = await collect(
      coachReplyStream(stream, ctx, [], "what pace for my run?", classify),
    );
    expect(out).toEqual([REPLIES.CRISIS]);
    expect(stream).not.toHaveBeenCalled();
  });

  it("redirects a nutrition question without opening the stream", async () => {
    const stream = vi.fn(streamOf("anything"));
    const out = await collect(
      coachReplyStream(stream, ctx, [], "what should I eat before my run?"),
    );
    expect(out).toEqual([REPLIES.NUTRITION_REDIRECT]);
    expect(stream).not.toHaveBeenCalled();
  });

  it("streams an in-context follow-up", async () => {
    const stream = vi.fn(streamOf("A smooth rep means reps in reserve."));
    const out = await collect(
      coachReplyStream(stream, ctx, benchTurn, "Can you explain that?"),
    );
    expect(out).toEqual(["A smooth rep means reps in reserve."]);
  });
});

// Point 4: a stream that ends without text is a failure the user can see.
describe("coachReplyStream with no text", () => {
  it.each([
    ["nothing", streamOf()],
    ["only whitespace", streamOf("  ", "\n")],
  ])("yields the unavailable line for %s", async (_name, stream) => {
    const out = await collect(
      coachReplyStream(stream, ctx, [], "what pace for my easy run?"),
    );
    expect(out).toEqual([UNAVAILABLE_REPLY]);
  });
});

// A Groq SSE response whose body is a real ReadableStream, so a read failure after
// the headers and the cancel on an early stop can be observed.
function sseResponse(
  events: string[],
  opts: { failAtEnd?: boolean; onCancel?: () => void } = {},
) {
  const encoder = new TextEncoder();
  const queue = [...events];
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const next = queue.shift();
      if (next !== undefined) {
        const event = { choices: [{ delta: { content: next } }] };
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        );
      } else if (opts.failAtEnd) {
        controller.error(new TypeError("terminated"));
      } else {
        controller.close();
      }
    },
    cancel() {
      opts.onCancel?.();
    },
  });
  return { res: new Response(body, { status: HTTP_OK }), body };
}

describe("groqChatStream transport failures (point 2)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("turns a body-read failure into a ProviderError", async () => {
    const { res } = sseResponse([], { failAtEnd: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res),
    );
    await expect(
      collect(groqChatStream("test-key")([])),
    ).rejects.toBeInstanceOf(ProviderError);
  });

  it("falls back to the other provider when the body fails before any text", async () => {
    const { res } = sseResponse([], { failAtEnd: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res),
    );
    const out = await collect(
      withStreamFallback(
        groqChatStream("test-key"),
        streamOf("From Gemini."),
      )([]),
    );
    expect(out).toEqual(["From Gemini."]);
  });

  it("does not switch providers when the body fails after text", async () => {
    const { res } = sseResponse(["Half a "], { failAtEnd: true });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res),
    );
    const backup = vi.fn(streamOf("other"));
    const pieces = withStreamFallback(
      groqChatStream("test-key"),
      backup,
    )([])[Symbol.asyncIterator]();
    expect(await pieces.next()).toEqual({ value: "Half a ", done: false });
    await expect(pieces.next()).rejects.toBeInstanceOf(ProviderError);
    expect(backup).not.toHaveBeenCalled();
  });
});

describe("groqChatStream early stop (point 3)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("cancels the upstream body and releases the lock when the reply check stops it", async () => {
    const onCancel = vi.fn();
    const { res, body } = sseResponse(
      [
        "Keep the weight. ",
        "That sounds like tendinitis. ",
        "Rest it for a week. ",
        "Then come back. ",
      ],
      { onCancel },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res),
    );
    const out = await collect(
      coachReplyStream(
        groqChatStream("test-key"),
        ctx,
        [],
        "how should I progress goblet squats?",
      ),
    );
    expect(out).toEqual(["Keep the weight. ", "\n\n" + REPLIES.NO_DIAGNOSIS]);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });

  it("cancels the upstream body when the reader stops early", async () => {
    const onCancel = vi.fn();
    const { res, body } = sseResponse(["One. ", "Two. ", "Three. "], {
      onCancel,
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => res),
    );
    const pieces = groqChatStream("test-key")([])[Symbol.asyncIterator]();
    expect(await pieces.next()).toEqual({ value: "One. ", done: false });
    await pieces.return?.(undefined);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(body.locked).toBe(false);
  });
});
