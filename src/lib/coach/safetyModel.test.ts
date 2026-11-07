// Tests for the model safety check (D15): request shape, policy kept apart from user text, strict parsing.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SAFETY_MODEL,
  SAFETY_POLICY,
  groqSafetyClassifier,
} from "./safetyModel";

function reply(content: string, status = 200) {
  return new Response(JSON.stringify({ choices: [{ message: { content } }] }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("groqSafetyClassifier", () => {
  it("sends the policy as the system message and the user text alone as the user message", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(reply('{"category":"NONE","rationale":"training"}'));
    vi.stubGlobal("fetch", fetchMock);
    await groqSafetyClassifier("test-key-not-real")("how many sets today?");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("openai/gpt-oss-safeguard-20b");
    expect(SAFETY_MODEL).toBe("openai/gpt-oss-safeguard-20b");
    expect(body.response_format).toEqual({ type: "json_object" });
    expect(body.reasoning_effort).toBe("low");
    expect(body.messages).toEqual([
      { role: "system", content: SAFETY_POLICY },
      { role: "user", content: "how many sets today?" },
    ]);
    expect(init.headers.Authorization).toBe("Bearer test-key-not-real");
  });

  it.each([
    ["CRISIS", "CRISIS"],
    ["MEDICAL", "MEDICAL"],
    ["DISTRESS", "DISTRESS"],
    ["NONE", "NONE"],
  ] as const)("reads the category %s", async (category, expected) => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(reply(`{"category":"${category}"}`)),
    );
    await expect(groqSafetyClassifier("k")("text")).resolves.toBe(expected);
  });

  it.each([
    ["an unknown category", '{"category":"MAYBE"}'],
    ["text that is not JSON", "CRISIS"],
    ["a missing category", '{"rationale":"x"}'],
  ])("throws on %s, so the word list decides", async (_name, content) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply(content)));
    await expect(groqSafetyClassifier("k")("text")).rejects.toThrow();
  });

  it("throws on an HTTP error without putting the key in the message", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(reply("", 503)));
    await expect(
      groqSafetyClassifier("secret-key-123")("text"),
    ).rejects.toThrow(/^safety check returned HTTP 503$/);
  });

  it("states the four categories and treats exaggeration with training context as distress, not crisis", () => {
    for (const word of ["CRISIS", "MEDICAL", "DISTRESS", "NONE"])
      expect(SAFETY_POLICY).toContain(word);
    expect(SAFETY_POLICY).toMatch(/gonna die on this run/i);
  });
});

describe("groqSafetyClassifier cancellation", () => {
  it("passes the caller's abort signal to the request", async () => {
    const fetchMock = vi.fn().mockResolvedValue(reply('{"category":"NONE"}'));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();
    await groqSafetyClassifier("k")("text", controller.signal);
    const signal = fetchMock.mock.calls[0][1].signal as AbortSignal;
    controller.abort();
    expect(signal.aborted).toBe(true);
  });
});
