// Pacing of the repeated eval runs (#64): free-tier limits turned into a wait and a daily budget.
import { describe, expect, it } from "vitest";
import {
  callGapMs,
  dailyCallBudget,
  paced,
  pendingRuns,
  rateLimitedOut,
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

describe("paced", () => {
  it("spaces call starts by the gap, counting the time the last call took", async () => {
    let clock = 0;
    const waits: number[] = [];
    const sleep = async (ms: number) => {
      waits.push(ms);
      clock += ms;
    };
    // Each call takes 10 s, so 50 s are left of a 60 s gap measured from its start.
    const slowDouble = async (x: number) => {
      clock += 10_000;
      return x * 2;
    };
    const call = paced(slowDouble, 60_000, () => clock, sleep);

    const first = await call(1);
    const second = await call(2);

    expect([first, second]).toEqual([2, 4]);
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
