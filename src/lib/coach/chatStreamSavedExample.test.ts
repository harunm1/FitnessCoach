// The demo fallback inside the streamed turn (D12, #59): a stored reply only after the
// providers failed with nothing shown, never in place of a guardrail reply.
import { describe, expect, it, vi } from "vitest";
import { UNAVAILABLE_REPLY, type CoachContext } from "./chat";
import { coachReplyStream, type SavedExample } from "./chatStream";
import { REPLIES } from "./guardrails";
import { ProviderError, type ChatStream } from "./providers";
import type { CoachRecord } from "./coachLog";

const DAYS = 3;
const RATE_LIMITED = 429;
const UNAVAILABLE = 503;

const ctx: CoachContext = {
  goal: "MUSCLE",
  level: "BEGINNER",
  daysPerWeek: DAYS,
  equipment: ["dumbbell"],
  injuries: null,
  sessionLines: ["Goblet squat 3 x 10"],
};

const STORED = "Try a dumbbell split squat instead. Keep 3 sets of 10.";

const failing: ChatStream = async function* () {
  yield* [];
  throw new ProviderError("rate limited", "Groq", RATE_LIMITED);
};

const collect = (it: AsyncIterable<string>) => Array.fromAsync(it);

function example(reply: string | undefined) {
  const show = vi.fn();
  const replyFor = vi.fn(() => reply);
  const saved: SavedExample = { replyFor, show };
  return { saved, show, replyFor };
}

describe("coachReplyStream with a saved example", () => {
  it("hands the stored reply to show and yields nothing when the providers fail", async () => {
    const { saved, show, replyFor } = example(STORED);
    const log = vi.fn<(record: CoachRecord) => Promise<void>>(
      async () => undefined,
    );
    const out = await collect(
      coachReplyStream(failing, ctx, [], "Swap this exercise", undefined, {
        log,
        savedExample: saved,
      }),
    );
    expect(out).toEqual([]);
    expect(replyFor).toHaveBeenCalledWith("Swap this exercise");
    expect(show).toHaveBeenCalledWith(STORED);
    // The provider failure is still the call's one record.
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0][0].outcome).toBe("error");
  });

  it("shows the unavailable line when no reply is stored for the question", async () => {
    const { saved, show } = example(undefined);
    const out = await collect(
      coachReplyStream(failing, ctx, [], "Something else", undefined, {
        savedExample: saved,
      }),
    );
    expect(out).toEqual([UNAVAILABLE_REPLY]);
    expect(show).not.toHaveBeenCalled();
  });

  it("does not serve a stored reply that fails the reply check", async () => {
    const { saved, show } = example("You probably have tendinitis.");
    const out = await collect(
      coachReplyStream(failing, ctx, [], "Swap this exercise", undefined, {
        savedExample: saved,
      }),
    );
    expect(out).toEqual([UNAVAILABLE_REPLY]);
    expect(show).not.toHaveBeenCalled();
  });

  it("keeps the live sentences and the unavailable line when the stream broke mid-reply", async () => {
    const { saved, show, replyFor } = example(STORED);
    const partial: ChatStream = async function* () {
      yield "Use a split squat. ";
      throw new ProviderError("down", "Gemini", UNAVAILABLE);
    };
    const out = await collect(
      coachReplyStream(partial, ctx, [], "Swap this exercise", undefined, {
        savedExample: saved,
      }),
    );
    expect(out).toEqual(["Use a split squat. ", "\n\n" + UNAVAILABLE_REPLY]);
    expect(replyFor).not.toHaveBeenCalled();
    expect(show).not.toHaveBeenCalled();
  });

  it("never replaces a guardrail reply, and never opens the stream for one", async () => {
    const { saved, replyFor } = example(STORED);
    const stream = vi.fn(failing);
    const out = await collect(
      coachReplyStream(
        stream,
        ctx,
        [],
        "I have a sharp pain in my knee",
        undefined,
        { savedExample: saved },
      ),
    );
    expect(out).toEqual([REPLIES.PAIN_STOP]);
    expect(stream).not.toHaveBeenCalled();
    expect(replyFor).not.toHaveBeenCalled();
  });

  it("is not used when the live reply succeeds", async () => {
    const { saved, replyFor } = example(STORED);
    const live: ChatStream = async function* () {
      yield "Swap to a goblet box squat. ";
    };
    const out = await collect(
      coachReplyStream(live, ctx, [], "Swap this exercise", undefined, {
        savedExample: saved,
      }),
    );
    expect(out).toEqual(["Swap to a goblet box squat. "]);
    expect(replyFor).not.toHaveBeenCalled();
  });

  it("hands over the stored reply when the stream ends with no text", async () => {
    const { saved, show } = example(STORED);
    const empty: ChatStream = async function* () {
      yield "  ";
    };
    const out = await collect(
      coachReplyStream(empty, ctx, [], "Swap this exercise", undefined, {
        savedExample: saved,
      }),
    );
    expect(out).toEqual([]);
    expect(show).toHaveBeenCalledWith(STORED);
  });
});
