import { beforeEach, describe, expect, it, vi } from "vitest";
import { UNAVAILABLE_REPLY } from "@/lib/coach/chat";
import { REPLIES } from "@/lib/coach/guardrails";
import { RATE_MINUTE_MESSAGE, SAVE_FAILED_MESSAGE } from "@/app/coach/copy";

const mocks = vi.hoisted(() => ({
  requireTier: vi.fn(),
  context: vi.fn(),
  conversation: vi.fn(),
  count: vi.fn(),
  save: vi.fn(),
  factory: vi.fn(),
  persist: vi.fn(),
  sink: vi.fn(),
  refresh: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.refresh }));
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

function request(
  input: unknown = { message: "How long should I rest between sets?" },
  headers: Record<string, string> = {},
) {
  return new Request("https://fitness.test/api/coach", {
    method: "POST",
    headers: {
      origin: "https://fitness.test",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(input),
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
  coachAttempts.clear();
  mocks.requireTier.mockResolvedValue({ ok: true, user: { id: "owner" } });
  mocks.context.mockResolvedValue({
    goal: "MUSCLE",
    level: "BEGINNER",
    daysPerWeek: 3,
    equipment: ["dumbbell"],
    injuries: null,
    sessionLines: [],
  });
  mocks.conversation.mockResolvedValue({
    id: 42,
    messages: [{ role: "USER", content: "My own workout" }],
  });
  mocks.count.mockResolvedValue(0);
  mocks.save.mockResolvedValue(undefined);
  mocks.persist.mockResolvedValue(undefined);
  mocks.sink.mockReturnValue(mocks.persist);
  mocks.factory.mockReturnValue(async function* () {
    yield "Rest 90 seconds. ";
    yield "Keep your form controlled.";
  });
});

describe("guarded streaming coach endpoint", () => {
  it.each([401, 403])(
    "returns %i JSON before any profile, provider or log work",
    async (status) => {
      mocks.requireTier.mockResolvedValue({
        ok: false,
        status,
        code: status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
        message: "Denied",
      });
      const response = await POST(request());
      expect(response.status).toBe(status);
      expect(response.headers.get("content-type")).toContain(
        "application/json",
      );
      expect(mocks.context).not.toHaveBeenCalled();
      expect(mocks.factory).not.toHaveBeenCalled();
      expect(mocks.sink).not.toHaveBeenCalled();
    },
  );
  it.each(["https://other.test", "null", ""])(
    "rejects foreign or missing origin %s",
    async (origin) => {
      const response = await POST(request(undefined, { origin }));
      expect(response.status).toBe(403);
      expect(mocks.requireTier).not.toHaveBeenCalled();
    },
  );
  it("fails closed when the access database fails", async () => {
    mocks.requireTier.mockRejectedValue(new Error("private database detail"));
    const response = await POST(request());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain("private database detail");
    expect(mocks.factory).not.toHaveBeenCalled();
  });
  it.each([
    { message: "" },
    { message: 5 },
    { message: "Hi", userId: "other" },
    { message: "Hi", history: [] },
  ])("rejects invalid input and submitted identity/history", async (input) => {
    expect((await POST(request(input))).status).toBe(400);
    expect(mocks.factory).not.toHaveBeenCalled();
  });
  it("bounds a body without Content-Length", async () => {
    const response = await POST(request({ message: "x".repeat(64_000) }));
    expect(response.status).toBe(413);
    expect(mocks.context).not.toHaveBeenCalled();
  });
  it("rejects non-JSON content and malformed JSON", async () => {
    expect(
      (await POST(request(undefined, { "content-type": "text/plain" }))).status,
    ).toBe(415);
    const malformed = new Request("https://fitness.test/api/coach", {
      method: "POST",
      headers: {
        origin: "https://fitness.test",
        "content-type": "application/json",
      },
      body: "{",
    });
    expect((await POST(malformed)).status).toBe(400);
  });
  it("streams checked pieces, saves under the session owner, then confirms success", async () => {
    const response = await POST(request());
    expect(response.headers.get("cache-control")).toContain("no-store");
    const reader = response.body!.getReader();
    const first = await reader.read();
    expect(new TextDecoder().decode(first.value)).toContain('"type":"delta"');
    expect(mocks.save).not.toHaveBeenCalled();
    let rest = "";
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      rest += new TextDecoder().decode(chunk.value);
    }
    expect(rest).toContain('"type":"saved"');
    expect(mocks.context).toHaveBeenCalledWith({}, "owner");
    expect(mocks.save).toHaveBeenCalledWith(
      {},
      "owner",
      42,
      "How long should I rest between sets?",
      "Rest 90 seconds. Keep your form controlled.",
    );
    expect(mocks.sink).toHaveBeenCalledWith("owner");
    expect(mocks.persist).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "chat", outcome: "ok" }),
    );
  });
  it("uses only server-loaded history", async () => {
    const called = vi.fn();
    mocks.factory.mockReturnValue(async function* (messages: unknown) {
      called(messages);
      yield "Rest 90 seconds.";
    });
    await events(await POST(request()));
    expect(called.mock.calls[0][0]).toContainEqual({
      role: "user",
      content: "My own workout",
    });
  });
  it("keeps existing message caps ahead of provider calls", async () => {
    mocks.count.mockResolvedValueOnce(5).mockResolvedValueOnce(5);
    const response = await POST(request());
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({
      message: RATE_MINUTE_MESSAGE,
    });
    expect(mocks.factory).not.toHaveBeenCalled();
  });
  it("keeps safety replies available at the message cap", async () => {
    mocks.count.mockResolvedValue(50);
    const response = await POST(
      request({ message: "My knee hurts during squats" }),
    );
    expect(response.status).toBe(429);
    expect(await response.json()).toMatchObject({ message: REPLIES.PAIN_STOP });
  });
  it("returns a fixed pain reply without opening a provider stream", async () => {
    const result = await events(
      await POST(request({ message: "My knee hurts during squats" })),
    );
    expect(result[0]).toEqual({ type: "delta", text: REPLIES.PAIN_STOP });
    expect(result.at(-1)).toEqual({ type: "saved" });
    expect(mocks.factory).not.toHaveBeenCalled();
    expect(mocks.persist).not.toHaveBeenCalled();
  });
  it("marks a failed provider as unsaved instead of storing its unavailable reply", async () => {
    mocks.factory.mockReturnValue(async function* () {
      throw new Error("private provider detail");
    });
    const result = await events(await POST(request()));
    expect(result.at(-1)).toEqual({
      type: "unsaved",
      message: UNAVAILABLE_REPLY,
    });
    expect(mocks.save).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("private provider detail");
  });
  it("keeps a partial reply unsaved after a mid-stream failure", async () => {
    mocks.factory.mockReturnValue(async function* () {
      yield "Rest 90 seconds. ";
      throw new Error("connection lost");
    });
    const result = await events(await POST(request()));
    expect(result[0].text).toBe("Rest 90 seconds. ");
    expect(result.at(-1).type).toBe("unsaved");
    expect(mocks.save).not.toHaveBeenCalled();
  });
  it("reports a failed save after the reply without claiming it was saved", async () => {
    mocks.save.mockRejectedValue(new Error("private SQL detail"));
    const result = await events(await POST(request()));
    expect(result.at(-1)).toEqual({
      type: "unsaved",
      message: SAVE_FAILED_MESSAGE,
    });
    expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("does not break a reply when best-effort event logging fails", async () => {
    mocks.persist.mockRejectedValue(new Error("log database unavailable"));
    expect((await events(await POST(request()))).at(-1).type).toBe("saved");
  });
  it("cancels upstream work without saving an unfinished exchange", async () => {
    const stopped = vi.fn();
    mocks.factory.mockReturnValue(async function* () {
      try {
        yield "Rest 90 seconds. ";
        yield "Keep going.";
      } finally {
        stopped();
      }
    });
    const response = await POST(request());
    const reader = response.body!.getReader();
    await reader.read();
    await reader.cancel();
    expect(stopped).toHaveBeenCalledOnce();
    expect(mocks.save).not.toHaveBeenCalled();
  });
});
