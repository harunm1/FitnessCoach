// Tests for the workout clock's pause and resume math (D37): duration counts active time only,
// and an idle pause starts at the last activity, not when the page noticed.
import { describe, expect, it } from "vitest";
import {
  activeSeconds,
  finishedActiveSeconds,
  IDLE_PAUSE_MS,
  idlePauseAt,
  lastActivityMs,
  pauseClock,
  resumeClock,
  type ActiveClock,
} from "./activeTime";

const T0 = Date.parse("2026-11-25T15:00:00.000Z");
const MINUTE_MS = 60_000;
const MIN_2 = 120_000;
const MIN_5 = 300_000;
const MIN_8 = 480_000;
const MIN_10 = 600_000;
const MIN_20 = 1_200_000;
const MIN_30 = 1_800_000;
const MIN_35 = 2_100_000;
const MIN_50 = 3_000_000;
const MIN_99 = 5_940_000;
const HOURS_3 = 10_800_000;
const BANKED = 100;
const BANKED_PLUS_MINUTE = 160;
const TEN_MIN_SECONDS = 600;
const TWO_MIN_SECONDS = 120;
const SMALL_BANK = 30;
const TINY_BANK = 5;
const FIFTEEN_MIN_SECONDS = 900;
const DAY_MS = 86_400_000;

const running = (since: number, banked = 0): ActiveClock => ({
  bankedSeconds: banked,
  activeSinceMs: since,
});

describe("activeSeconds", () => {
  it("counts the running stretch on top of the banked time", () => {
    expect(activeSeconds(running(T0, BANKED), T0 + MINUTE_MS)).toBe(
      BANKED_PLUS_MINUTE,
    );
  });

  it("counts only the banked time while paused", () => {
    const paused: ActiveClock = {
      bankedSeconds: TEN_MIN_SECONDS,
      activeSinceMs: null,
    };
    expect(activeSeconds(paused, T0 + DAY_MS)).toBe(TEN_MIN_SECONDS);
  });

  it("never counts a negative stretch when the clock is behind the start", () => {
    expect(activeSeconds(running(T0, TINY_BANK), T0 - MINUTE_MS)).toBe(
      TINY_BANK,
    );
  });
});

describe("pauseClock", () => {
  it("banks the stretch so far and stops the clock", () => {
    const paused = pauseClock(running(T0), T0 + MIN_10, T0 + MIN_10);
    expect(paused).toEqual({
      bankedSeconds: TEN_MIN_SECONDS,
      activeSinceMs: null,
    });
  });

  it("starts the pause at the requested time, not at the time it was noticed", () => {
    const paused = pauseClock(running(T0), T0 + MIN_10, T0 + MIN_50);
    expect(paused.bankedSeconds).toBe(TEN_MIN_SECONDS);
  });

  it("cannot reach back before the running stretch began", () => {
    const paused = pauseClock(running(T0 + MIN_5, SMALL_BANK), T0, T0 + MIN_8);
    expect(paused.bankedSeconds).toBe(SMALL_BANK);
  });

  it("cannot pause in the future", () => {
    const paused = pauseClock(running(T0), T0 + MIN_99, T0 + MIN_2);
    expect(paused.bankedSeconds).toBe(TWO_MIN_SECONDS);
  });

  it("leaves an already paused clock alone", () => {
    const already: ActiveClock = {
      bankedSeconds: SMALL_BANK,
      activeSinceMs: null,
    };
    expect(pauseClock(already, T0, T0 + MINUTE_MS)).toEqual(already);
  });
});

describe("resumeClock", () => {
  it("starts a new stretch and keeps the banked time", () => {
    const resumed = resumeClock(
      { bankedSeconds: TEN_MIN_SECONDS, activeSinceMs: null },
      T0,
    );
    expect(resumed).toEqual({
      bankedSeconds: TEN_MIN_SECONDS,
      activeSinceMs: T0,
    });
  });

  it("leaves a running clock alone", () => {
    const already = running(T0, TINY_BANK);
    expect(resumeClock(already, T0 + MINUTE_MS)).toEqual(already);
  });
});

describe("pause and resume together", () => {
  it("10 min of work, 20 min paused, 5 min of work is 15 minutes of workout", () => {
    const afterWork = pauseClock(running(T0), T0 + MIN_10, T0 + MIN_10);
    const back = resumeClock(afterWork, T0 + MIN_30);
    expect(activeSeconds(back, T0 + MIN_35)).toBe(FIFTEEN_MIN_SECONDS);
    // Not counted: the 20 minutes between 10 and 30.
    expect(MIN_30 - MIN_10).toBe(MIN_20);
  });
});

describe("idlePauseAt", () => {
  const lastActivity = T0;

  it("does nothing before the idle limit", () => {
    expect(
      idlePauseAt(lastActivity, lastActivity + IDLE_PAUSE_MS - 1),
    ).toBeNull();
  });

  it("pauses at the last activity once the limit is reached", () => {
    expect(idlePauseAt(lastActivity, lastActivity + IDLE_PAUSE_MS)).toBe(
      lastActivity,
    );
  });

  it("still pauses at the last activity when it is noticed hours later", () => {
    expect(idlePauseAt(lastActivity, lastActivity + HOURS_3)).toBe(
      lastActivity,
    );
  });

  it("is 30 minutes", () => {
    expect(IDLE_PAUSE_MS).toBe(MIN_30);
  });
});

describe("lastActivityMs", () => {
  it("is the newest of the running stretch's start, the last set and the last interaction", () => {
    expect(
      lastActivityMs({
        activeSinceMs: T0,
        lastSetMs: T0 + MIN_5,
        lastInteractionMs: T0 + MIN_2,
      }),
    ).toBe(T0 + MIN_5);
  });

  it("ignores what is missing", () => {
    expect(
      lastActivityMs({
        activeSinceMs: T0,
        lastSetMs: null,
        lastInteractionMs: null,
      }),
    ).toBe(T0);
  });

  it("a recent tap beats an old set", () => {
    expect(
      lastActivityMs({
        activeSinceMs: T0,
        lastSetMs: T0 + MINUTE_MS,
        lastInteractionMs: T0 + MIN_20,
      }),
    ).toBe(T0 + MIN_20);
  });
});

describe("finishedActiveSeconds", () => {
  const TEN_MIN_PLUS_FIVE = 900;

  it("counts to now for a workout still in use", () => {
    expect(
      finishedActiveSeconds(running(T0), T0 + MIN_10, T0 + MIN_10 + MIN_5),
    ).toBe(TEN_MIN_PLUS_FIVE);
  });

  it("stops at the last activity when the workout was left running for hours", () => {
    expect(finishedActiveSeconds(running(T0), T0 + MIN_10, T0 + HOURS_3)).toBe(
      TEN_MIN_SECONDS,
    );
  });

  it("with no set logged, stops at the start of the running stretch", () => {
    expect(finishedActiveSeconds(running(T0), null, T0 + HOURS_3)).toBe(0);
  });

  it("a paused clock keeps exactly its banked time", () => {
    const paused: ActiveClock = {
      bankedSeconds: TEN_MIN_SECONDS,
      activeSinceMs: null,
    };
    expect(finishedActiveSeconds(paused, T0 + MIN_5, T0 + HOURS_3)).toBe(
      TEN_MIN_SECONDS,
    );
  });
});
