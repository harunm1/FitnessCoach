import { afterEach, describe, expect, it, vi } from "vitest";
import { UNAVAILABLE_REPLY, coachReplyStream, type CoachContext } from "./chat";
import { REPLIES } from "./guardrails";
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
