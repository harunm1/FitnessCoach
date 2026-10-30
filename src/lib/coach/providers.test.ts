// The provider adapters with fetch mocked, so CI needs no key and no network.
import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePlan } from "./generatePlan";
import {
  coachModel,
  GEMINI_MODEL,
  geminiModel,
  GROQ_MODEL,
  groqModel,
  ProviderError,
  withFallback,
  withRetry,
} from "./providers";
import type { LibraryExercise } from "./verify";

const KEY = "test-key-not-real";
const plan = { name: "P", days: [] };

function mockFetch(status: number, body: unknown) {
  const fn = vi.fn(async () => new Response(JSON.stringify(body), { status }));
  vi.stubGlobal("fetch", fn);
  return fn;
}

const groqReply = (content: unknown) => ({
  choices: [{ message: { content } }],
});
const geminiReply = (parts: { text: string; thought?: boolean }[]) => ({
  candidates: [{ content: { parts } }],
});

// The URL, headers and parsed body of the first call to the mocked fetch.
function sent(fn: ReturnType<typeof mockFetch>) {
  const [url, init] = fn.mock.calls[0] as unknown as [string, RequestInit];
  return {
    url,
    headers: init.headers as Record<string, string>,
    body: JSON.parse(init.body as string),
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("groqModel", () => {
  it("sends the prompt in JSON mode with the key and returns the parsed plan", async () => {
    const fetchMock = mockFetch(200, groqReply(JSON.stringify(plan)));
    await expect(groqModel(KEY)("Build a plan as JSON")).resolves.toEqual(plan);
    const req = sent(fetchMock);
    expect(req.url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect(req.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(req.body).toMatchObject({
      model: GROQ_MODEL,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: "Build a plan as JSON" }],
    });
  });

  it("throws on an HTTP error without putting the key in the message", async () => {
    mockFetch(429, { error: "rate limited" });
    const err = await groqModel(KEY)("x").catch((e: Error) => e);
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("Groq returned HTTP 429");
    expect((err as Error).message).not.toContain(KEY);
  });

  it("throws when the reply is not JSON or is missing", async () => {
    mockFetch(200, groqReply("Sure! Here is your plan"));
    await expect(groqModel(KEY)("x")).rejects.toThrow("not valid JSON");
    mockFetch(200, { choices: [] });
    await expect(groqModel(KEY)("x")).rejects.toThrow("no text");
  });
});

describe("geminiModel", () => {
  it("sends the prompt with a JSON response type and returns the parsed plan", async () => {
    const fetchMock = mockFetch(
      200,
      geminiReply([{ text: JSON.stringify(plan) }]),
    );
    await expect(geminiModel(KEY)("Build a plan as JSON")).resolves.toEqual(
      plan,
    );
    const req = sent(fetchMock);
    expect(req.url).toBe(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    );
    expect(req.headers["x-goog-api-key"]).toBe(KEY);
    expect(req.body).toMatchObject({
      contents: [{ role: "user", parts: [{ text: "Build a plan as JSON" }] }],
      generationConfig: { responseMimeType: "application/json" },
    });
  });

  it("skips a thought part and parses the answer", async () => {
    mockFetch(
      200,
      geminiReply([
        { text: "thinking...", thought: true },
        { text: JSON.stringify(plan) },
      ]),
    );
    await expect(geminiModel(KEY)("x")).resolves.toEqual(plan);
  });

  it("throws on an HTTP error", async () => {
    mockFetch(503, {});
    await expect(geminiModel(KEY)("x")).rejects.toThrow(
      "Gemini returned HTTP 503",
    );
  });
});

describe("coachModel", () => {
  it("uses Groq by default and Gemini when COACH_PROVIDER says so", async () => {
    const fetchMock = mockFetch(200, groqReply("{}"));
    await coachModel({ GROQ_API_KEY: KEY })("x");
    expect(sent(fetchMock).url).toContain("api.groq.com");

    const geminiFetch = mockFetch(200, geminiReply([{ text: "{}" }]));
    await coachModel({ COACH_PROVIDER: "Gemini", GEMINI_API_KEY: KEY })("x");
    expect(sent(geminiFetch).url).toContain(
      "generativelanguage.googleapis.com",
    );
  });

  it("names the missing key and rejects an unknown provider", () => {
    expect(() => coachModel({})).toThrow("GROQ_API_KEY is not set");
    expect(() => coachModel({ COACH_PROVIDER: "gemini" })).toThrow(
      "GEMINI_API_KEY is not set",
    );
    expect(() =>
      coachModel({ COACH_PROVIDER: "openai", GROQ_API_KEY: KEY }),
    ).toThrow("must be groq or gemini");
  });
});

describe("generatePlan with a provider", () => {
  it("falls back to the rule-based plan when the provider keeps failing", async () => {
    const fetchMock = mockFetch(500, {});
    const library: LibraryExercise[] = [
      {
        id: "pushup",
        equipment: "body only",
        primaryMuscles: ["chest"],
        secondaryMuscles: [],
      },
    ];
    const result = await generatePlan(
      groqModel(KEY),
      { daysPerWeek: 1, equipment: [], avoidMuscles: [] },
      library,
    );
    expect(result.source).toBe("DEFAULT");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

// One response per call, in order; headers allow a Retry-After.
function queueFetch(
  ...responses: { status: number; body: unknown; headers?: HeadersInit }[]
) {
  const fn = vi.fn<typeof fetch>();
  for (const r of responses) {
    fn.mockResolvedValueOnce(
      new Response(JSON.stringify(r.body), {
        status: r.status,
        headers: r.headers,
      }),
    );
  }
  vi.stubGlobal("fetch", fn);
  return fn;
}

const noSleep = vi.fn<(ms: number) => Promise<void>>(async () => {});

describe("withRetry", () => {
  it("waits the Retry-After a 429 asks for, then succeeds", async () => {
    const fetchMock = queueFetch(
      { status: 429, body: {}, headers: { "retry-after": "2" } },
      { status: 200, body: groqReply("{}") },
    );
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    await expect(withRetry(groqModel(KEY), { sleep })("x")).resolves.toEqual(
      {},
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledWith(2000);
  });

  it("reads Gemini's retryDelay from the error body", async () => {
    queueFetch(
      {
        status: 429,
        body: { error: { details: [{ retryDelay: "3s" }] } },
      },
      { status: 200, body: geminiReply([{ text: "{}" }]) },
    );
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    await withRetry(geminiModel(KEY), { sleep })("x");
    expect(sleep).toHaveBeenCalledWith(3000);
  });

  it("backs off on a 503 and gives up after two retries", async () => {
    const fetchMock = queueFetch(
      { status: 503, body: {} },
      { status: 503, body: {} },
      { status: 503, body: {} },
    );
    const sleep = vi.fn<(ms: number) => Promise<void>>(async () => {});
    await expect(
      withRetry(geminiModel(KEY), { sleep })("x"),
    ).rejects.toBeInstanceOf(ProviderError);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    const [first, second] = sleep.mock.calls.map((c) => c[0] as number);
    expect(first).toBeGreaterThanOrEqual(500);
    expect(first).toBeLessThanOrEqual(1000);
    expect(second).toBeGreaterThanOrEqual(1000);
    expect(second).toBeLessThanOrEqual(2000);
  });

  it("does not retry a 400, or wait out a Retry-After longer than the cap", async () => {
    let fetchMock = queueFetch({ status: 400, body: {} });
    await expect(
      withRetry(groqModel(KEY), { sleep: noSleep })("x"),
    ).rejects.toThrow("HTTP 400");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock = queueFetch({
      status: 429,
      body: {},
      headers: { "retry-after": "45" },
    });
    await expect(
      withRetry(groqModel(KEY), { sleep: noSleep })("x"),
    ).rejects.toThrow("HTTP 429");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a timeout on the same provider", async () => {
    const fetchMock = vi.fn(async () => {
      throw new DOMException("timed out", "TimeoutError");
    });
    vi.stubGlobal("fetch", fetchMock);
    const err = await withRetry(groqModel(KEY), { sleep: noSleep })("x").catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ProviderError);
    expect((err as ProviderError).timedOut).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a reply that is not JSON; that is generatePlan's job", async () => {
    const fetchMock = queueFetch({ status: 200, body: groqReply("not json") });
    await expect(
      withRetry(groqModel(KEY), { sleep: noSleep })("x"),
    ).rejects.toThrow("not valid JSON");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("withFallback and coachModel with both keys", () => {
  it("moves to Gemini when Groq stays rate-limited, and reports each step", async () => {
    const fetchMock = queueFetch(
      { status: 429, body: {}, headers: { "retry-after": "1" } },
      { status: 429, body: {}, headers: { "retry-after": "1" } },
      { status: 429, body: {}, headers: { "retry-after": "1" } },
      { status: 200, body: geminiReply([{ text: JSON.stringify(plan) }]) },
    );
    const events: unknown[] = [];
    const model = coachModel(
      { GROQ_API_KEY: KEY, GEMINI_API_KEY: KEY },
      { sleep: noSleep, onEvent: (e) => events.push(e) },
    );
    await expect(model("x")).resolves.toEqual(plan);
    const urls = fetchMock.mock.calls.map((c) => String(c[0]));
    expect(urls.slice(0, 3).every((u) => u.includes("api.groq.com"))).toBe(
      true,
    );
    expect(urls[3]).toContain("generativelanguage.googleapis.com");
    expect(events).toEqual([
      { provider: "Groq", action: "retry", status: 429, waitMs: 1000 },
      { provider: "Groq", action: "retry", status: 429, waitMs: 1000 },
      { provider: "Groq", action: "fallback", status: 429 },
    ]);
  });

  it("does not switch provider for a bad reply", async () => {
    const primary = vi.fn(async () => {
      throw new Error("Groq reply was not valid JSON");
    });
    const fallback = vi.fn(async () => ({}));
    await expect(withFallback(primary, fallback)("x")).rejects.toThrow(
      "not valid JSON",
    );
    expect(fallback).not.toHaveBeenCalled();
  });

  it("uses one provider when only its key is set", async () => {
    const fetchMock = queueFetch({ status: 503, body: {} });
    const model = coachModel(
      { GROQ_API_KEY: KEY },
      { retries: 0, sleep: noSleep },
    );
    await expect(model("x")).rejects.toThrow("HTTP 503");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
