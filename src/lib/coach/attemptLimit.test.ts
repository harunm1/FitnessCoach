// The per-user attempt limiter for coach messages (#63): counted before the model call, per minute and per day.
import { describe, expect, it } from "vitest";
import { createAttemptLimiter } from "./attemptLimit";

const MINUTE = 60_000;
const TWO_MINUTES = MINUTE + MINUTE;
const START = 0;
// Small limits, so each test reaches them in a few calls; the other limit stays out of the way.
const ONE = 1;
const TWO = 2;
const THREE = 3;
const OUT_OF_THE_WAY = 100;
const TWO_A_MINUTE = { perMinute: TWO, perDay: OUT_OF_THE_WAY };
const THREE_A_DAY = { perMinute: OUT_OF_THE_WAY, perDay: THREE };
const ONE_A_MINUTE = { perMinute: ONE, perDay: OUT_OF_THE_WAY };

describe("createAttemptLimiter", () => {
  it("allows up to the per-minute limit, then refuses until the minute has passed", () => {
    let clock = START;
    const limiter = createAttemptLimiter(TWO_A_MINUTE, () => clock);

    expect([limiter.take("a"), limiter.take("a"), limiter.take("a")]).toEqual([
      null,
      null,
      "minute",
    ]);
    clock += MINUTE + 1;
    expect(limiter.take("a")).toBeNull();
  });

  it("refuses past the daily limit even when each minute is quiet", () => {
    let clock = START;
    const limiter = createAttemptLimiter(THREE_A_DAY, () => clock);

    const results = ["first", "second", "third", "fourth"].map(() => {
      clock += TWO_MINUTES;
      return limiter.take("a");
    });

    expect(results).toEqual([null, null, null, "day"]);
  });

  it("counts each user separately", () => {
    const limiter = createAttemptLimiter(ONE_A_MINUTE, () => START);

    expect(limiter.take("a")).toBeNull();
    expect(limiter.take("b")).toBeNull();
    expect(limiter.take("a")).toBe("minute");
  });

  it("starts empty again after clear", () => {
    const limiter = createAttemptLimiter(ONE_A_MINUTE, () => START);
    limiter.take("a");

    limiter.clear();

    expect(limiter.take("a")).toBeNull();
  });
});
