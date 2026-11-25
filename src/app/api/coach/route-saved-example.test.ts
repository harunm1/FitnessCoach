// The streamed route's demo fallback (D12, #59): a stored reply as a marked example,
// only in demo mode, only for a scripted question, never saved as a coach reply.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNAVAILABLE_REPLY } from "@/lib/coach/chat";
import { DEMO_REPLY_CACHE } from "@/lib/coach/demoReplies";
import { SAVED_EXAMPLE_MESSAGE } from "@/app/coach/copy";

const mocks = vi.hoisted(() => ({
  requireTier: vi.fn(),
  context: vi.fn(),
  conversation: vi.fn(),
  count: vi.fn(),
  save: vi.fn(),
  factory: vi.fn(),
  persist: vi.fn(),
  sink: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/access", () => ({ requireTier: mocks.requireTier }));
vi.mock("@/lib/prisma", () => ({ prisma: {} }));
vi.mock("@/lib/coach/conversation", () => ({
  coachContextFor: mocks.context,
  loadConversation: mocks.conversation,
  userMessagesSince: mocks.count,
  saveExchange: mocks.save,
}));
vi.mock("@/lib/coach/coachSink", () => ({ prismaCoachSink: mocks.sink }));
vi.mock("@/lib/coach/providers", async (original) => ({
  ...(await original<typeof import("@/lib/coach/providers")>()),
  coachChatStream: mocks.factory,
}));
import { POST } from "./route";
import { coachAttempts } from "@/app/coach/limits";

const DAYS = 3;
const stored = DEMO_REPLY_CACHE.replies[0];

function request(message: string) {
  return new Request("https://fitness.test/api/coach", {
    method: "POST",
    headers: {
      origin: "https://fitness.test",
      "content-type": "application/json",
    },
    body: JSON.stringify({ message }),
  });
}
async function events(response: Response) {
  return (await response.text())
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv("GROQ_API_KEY", "");
  vi.stubEnv("COACH_DEMO_MODE", "1");
  coachAttempts.clear();
  mocks.requireTier.mockResolvedValue({ ok: true, user: { id: "owner" } });
  mocks.context.mockResolvedValue({
    goal: "MUSCLE",
    level: "BEGINNER",
    daysPerWeek: DAYS,
    equipment: ["dumbbell"],
    injuries: null,
    sessionLines: [],
  });
  mocks.conversation.mockResolvedValue(null);
  mocks.count.mockResolvedValue(0);
  mocks.persist.mockResolvedValue(undefined);
  mocks.sink.mockReturnValue(mocks.persist);
  mocks.factory.mockReturnValue(async function* () {
    yield* [];
    throw new Error("both providers down");
  });
});

describe("streamed coach route, saved example in demo mode", () => {
  it("sends the stored reply as a marked example and saves nothing", async () => {
    const result = await events(await POST(request(stored.question)));
    expect(result).toEqual([
      {
        type: "example",
        reply: stored.reply,
        message: SAVED_EXAMPLE_MESSAGE,
      },
    ]);
    expect(mocks.save).not.toHaveBeenCalled();
    // The provider failure is still logged.
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({ outcome: "error" }),
    );
  });

  it("shows the unavailable line for a question with no stored reply", async () => {
    const result = await events(await POST(request("Can I run today?")));
    expect(result.at(-1)).toEqual({
      type: "unsaved",
      message: UNAVAILABLE_REPLY,
    });
  });

  it("never serves a stored reply outside demo mode", async () => {
    vi.stubEnv("COACH_DEMO_MODE", "");
    const result = await events(await POST(request(stored.question)));
    expect(result.at(-1)).toEqual({
      type: "unsaved",
      message: UNAVAILABLE_REPLY,
    });
    expect(JSON.stringify(result)).not.toContain('"example"');
  });

  it("streams and saves the live reply when a provider answers", async () => {
    mocks.factory.mockReturnValue(async function* () {
      yield "Swap to a goblet box squat. ";
    });
    mocks.save.mockResolvedValue(undefined);
    const result = await events(await POST(request(stored.question)));
    expect(result).toEqual([
      { type: "delta", text: "Swap to a goblet box squat. " },
      { type: "saved" },
    ]);
  });
});
