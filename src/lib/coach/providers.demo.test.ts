// Demo mode in the provider chain (#59, D12): no retry waits and a short call limit, so a provider drop reaches the fallback at once.
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  coachChatModel,
  coachModel,
  DEMO_TIMEOUT_MS,
  groqModel,
  isDemoMode,
  ProviderError,
  retryOptionsFor,
  type ProviderEvent,
} from "./providers";

const KEY = "test-key-not-real";
const BOTH = { GROQ_API_KEY: KEY, GEMINI_API_KEY: KEY };
const DEMO = { ...BOTH, COACH_DEMO_MODE: "1" };
const plan = { name: "P", days: [] };
const HTTP_OK = 200;
const HTTP_TOO_MANY = 429;
const EIGHT_SECONDS = 8_000;
const SHORT_LIMIT_MS = 50;
const WELL_UNDER_DEFAULT_MS = 2_000; // far below the 30 s default limit
const ONE_CALL_EACH = 2; // Groq once, then Gemini once
const RETRIES_OUTSIDE_DEMO = 2;

const rateLimited = () =>
  new Response("{}", {
    status: HTTP_TOO_MANY,
    headers: { "retry-after": "1" },
  });
const geminiOk = (text: string) =>
  new Response(
    JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }),
    { status: HTTP_OK },
  );

// Groq always answers 429; Gemini answers with the given text.
function groqDownGeminiUp(text: string) {
  const fn = vi.fn(async (url: string) =>
    url.includes("groq") ? rateLimited() : geminiOk(text),
  );
  vi.stubGlobal("fetch", fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("isDemoMode and retryOptionsFor", () => {
  it("reads COACH_DEMO_MODE as 1 or true, and nothing else", () => {
    expect(isDemoMode({ COACH_DEMO_MODE: "1" })).toBe(true);
    expect(isDemoMode({ COACH_DEMO_MODE: " TRUE " })).toBe(true);
    expect(isDemoMode({ COACH_DEMO_MODE: "0" })).toBe(false);
    expect(isDemoMode({ COACH_DEMO_MODE: "" })).toBe(false);
    expect(isDemoMode({})).toBe(false);
  });

  it("turns off retries and shortens the call limit in demo mode only", () => {
    expect(DEMO_TIMEOUT_MS).toBe(EIGHT_SECONDS);
    expect(retryOptionsFor({ COACH_DEMO_MODE: "1" })).toMatchObject({
      retries: 0,
      timeoutMs: DEMO_TIMEOUT_MS,
    });
    expect(retryOptionsFor({})).toEqual({});
  });

  it("keeps an explicit option over the demo default", () => {
    expect(
      retryOptionsFor({ COACH_DEMO_MODE: "1" }, { timeoutMs: SHORT_LIMIT_MS }),
    ).toMatchObject({ retries: 0, timeoutMs: SHORT_LIMIT_MS });
  });
});

describe("coachModel in demo mode", () => {
  it("moves to the other provider on a rate limit without waiting or retrying", async () => {
    const fetchMock = groqDownGeminiUp(JSON.stringify(plan));
    const sleep = vi.fn(async () => {});
    const events: ProviderEvent[] = [];
    const model = coachModel(DEMO, { sleep, onEvent: (e) => events.push(e) });
    await expect(model("Build a plan as JSON")).resolves.toEqual(plan);
    expect(sleep).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(ONE_CALL_EACH);
    expect(events.map((e) => e.action)).toEqual(["fallback", "served"]);
  });

  it("still retries outside demo mode (the D6 chain is unchanged)", async () => {
    groqDownGeminiUp(JSON.stringify(plan));
    const sleep = vi.fn(async () => {});
    await coachModel(BOTH, { sleep })("Build a plan as JSON");
    expect(sleep).toHaveBeenCalledTimes(RETRIES_OUTSIDE_DEMO);
  });

  it("applies to the chat model too", async () => {
    const fetchMock = groqDownGeminiUp("Keep your back flat.");
    const sleep = vi.fn(async () => {});
    const chat = coachChatModel(DEMO, { sleep });
    await expect(chat([{ role: "user", content: "Row cue?" }])).resolves.toBe(
      "Keep your back flat.",
    );
    expect(sleep).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(ONE_CALL_EACH);
  });
});

describe("the call limit", () => {
  // A provider that never answers until the request is aborted.
  function stalled() {
    const fn = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener("abort", () =>
            reject(init.signal?.reason),
          );
        }),
    );
    vi.stubGlobal("fetch", fn);
    return fn;
  }

  it("stops a stalled call at the given limit and reports a timeout", async () => {
    stalled();
    const started = Date.now();
    const error = await groqModel(KEY, undefined, {
      timeoutMs: SHORT_LIMIT_MS,
    })("Build a plan as JSON").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).timedOut).toBe(true);
    expect(Date.now() - started).toBeLessThan(WELL_UNDER_DEFAULT_MS);
  });

  it("passes the limit from coachModel's options to both providers", async () => {
    const fetchMock = stalled();
    const started = Date.now();
    const model = coachModel(DEMO, { timeoutMs: SHORT_LIMIT_MS });
    await expect(model("Build a plan as JSON")).rejects.toBeInstanceOf(
      ProviderError,
    );
    expect(fetchMock).toHaveBeenCalledTimes(ONE_CALL_EACH);
    expect(Date.now() - started).toBeLessThan(WELL_UNDER_DEFAULT_MS);
  });
});
