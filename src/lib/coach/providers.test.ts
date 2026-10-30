// The provider adapters with fetch mocked, so CI needs no key and no network.
import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePlan } from "./generatePlan";
import {
  coachModel,
  GEMINI_MODEL,
  geminiModel,
  GROQ_MODEL,
  groqModel,
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
