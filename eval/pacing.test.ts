// Pacing of the repeated eval runs (#64): free-tier limits turned into a wait and a daily budget.
import { describe, expect, it } from "vitest";
import {
  callGapMs,
  dailyCallBudget,
  pacer,
  isTransportError,
  pendingRuns,
  permanentlyRefused,
  positiveNumber,
  rateLimitedOut,
  resumeCommand,
} from "./pacing";

describe("callGapMs", () => {
  it("waits long enough for the token-per-minute limit when it binds first", () => {
    expect(callGapMs({ rpm: 30, tpm: 8000 }, 8000)).toBe(60_000);
  });

  it("waits for the request-per-minute limit when calls are small", () => {
    expect(callGapMs({ rpm: 30, tpm: 8000 }, 100)).toBe(2_000);
  });

  it("uses the request limit alone when no token limit is known", () => {
    expect(callGapMs({ rpm: 4 }, 8000)).toBe(15_000);
  });
});

describe("dailyCallBudget", () => {
  it("is the smaller of the daily request cap and the daily token cap", () => {
    expect(dailyCallBudget({ rpd: 1000, tpd: 200_000 }, 8000)).toBe(25);
  });

  it("is the daily request cap when no token cap is known", () => {
    expect(dailyCallBudget({ rpd: 20 }, 8000)).toBe(20);
  });
});

describe("pendingRuns", () => {
  it("lists the runs still to do, one profile at a time", () => {
    const done = [{ id: "a", run: 1 }];

    expect(pendingRuns(["a", "b"], 3, done)).toEqual([
      { id: "a", run: 2 },
      { id: "a", run: 3 },
      { id: "b", run: 1 },
      { id: "b", run: 2 },
      { id: "b", run: 3 },
    ]);
  });
});

describe("pacer", () => {
  it("spaces call starts by the gap, counting the time the last call took", async () => {
    let clock = 0;
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
      clock += ms;
    };
    const gate = pacer(60_000, () => clock, sleep);

    await gate(); // first call starts at once
    clock += 10_000; // and takes 10 s
    await gate(); // so 50 s are left of the 60 s gap measured from its start
    clock += 70_000; // a slow call
    await gate(); // longer than the gap: no wait

    expect(waits).toEqual([50_000]);
  });
});

describe("rateLimitedOut", () => {
  it("is true when every call was refused with HTTP 429", () => {
    const calls = [
      { error: "groq returned HTTP 429" },
      { error: "groq returned HTTP 429" },
    ];

    expect(rateLimitedOut(calls)).toBe(true);
  });

  it("is false when any call got a reply or failed another way", () => {
    expect(
      rateLimitedOut([{ error: "groq returned HTTP 429" }, { reply: {} }]),
    ).toBe(false);
    expect(rateLimitedOut([{ error: "groq returned HTTP 503" }])).toBe(false);
    expect(rateLimitedOut([])).toBe(false);
  });
});

describe("isTransportError", () => {
  it("is true for rate limits, request timeouts, server errors and a failed request", () => {
    for (const e of [
      "Groq returned HTTP 429",
      "Gemini returned HTTP 503",
      "Groq returned HTTP 408",
      "Groq request failed",
    ]) {
      expect(isTransportError(e)).toBe(true);
    }
  });

  it("is false for faults in the reply, a client error and our own timeout", () => {
    for (const e of [
      "Groq reply was not valid JSON",
      "Groq reply had no text",
      "Groq returned HTTP 400",
      "Groq request timed out",
      undefined,
    ]) {
      expect(isTransportError(e)).toBe(false);
    }
  });
});

describe("permanentlyRefused", () => {
  it("is true when every call got a client error other than 408 and 429", () => {
    expect(
      permanentlyRefused([
        { error: "Groq returned HTTP 401" },
        { error: "Groq returned HTTP 401" },
      ]),
    ).toBe(true);
    expect(permanentlyRefused([{ error: "Groq returned HTTP 404" }])).toBe(
      true,
    );
  });

  it("is false for transport errors, replies, mixed calls and no calls", () => {
    expect(permanentlyRefused([{ error: "Groq returned HTTP 429" }])).toBe(
      false,
    );
    expect(permanentlyRefused([{ error: "Groq returned HTTP 503" }])).toBe(
      false,
    );
    expect(permanentlyRefused([{ reply: {} }])).toBe(false);
    expect(
      permanentlyRefused([{ error: "Groq returned HTTP 401" }, { reply: {} }]),
    ).toBe(false);
    expect(permanentlyRefused([])).toBe(false);
  });
});

describe("positiveNumber", () => {
  it("uses the fallback when the setting is absent", () => {
    expect(positiveNumber("EVAL_GAP_MS", undefined, 60000)).toBe(60000);
  });

  it("reads a positive number", () => {
    expect(positiveNumber("EVAL_GAP_MS", "15000", 60000)).toBe(15000);
  });

  it("throws on an empty, non-numeric, zero or negative setting instead of switching the safeguard off", () => {
    for (const raw of ["", "abc", "0", "-5", "Infinity"]) {
      expect(() => positiveNumber("EVAL_GAP_MS", raw, 60000)).toThrow(
        /EVAL_GAP_MS/,
      );
    }
  });
});

describe("resumeCommand", () => {
  it("keeps the profile list so a resume does not run every profile", () => {
    expect(
      resumeCommand("groq", ["gym-3-days", "home-2-days"], 5, "out.jsonl"),
    ).toBe(
      "npx tsx eval/coachEval.ts groq repeat gym-3-days,home-2-days --repeat 5 --file out.jsonl",
    );
  });

  it("omits the list when all profiles were asked for", () => {
    expect(resumeCommand("gemini", undefined, 3, "out.jsonl")).toBe(
      "npx tsx eval/coachEval.ts gemini repeat --repeat 3 --file out.jsonl",
    );
  });
});
