// Tests for the auto-start rest timer helper (live feedback 24 Nov, item 2): a set that was
// just logged starts the rest countdown; an old set, for example after a page reload, does not.
import { describe, expect, it } from "vitest";
import { latestLoggedAt, restSecondsRemaining } from "./restRemaining";

const logged = Date.parse("2026-11-25T15:00:00.000Z");
const REST = 90;
const SECOND_MS = 1000;
const HALF_MINUTE_MS = 30_000;
const REST_MS = REST * SECOND_MS;
const HOUR_MS = 3_600_000;
const SKEW_MS = 4_000;
const REST_LEFT_AFTER_HALF_MINUTE = 60;

describe("restSecondsRemaining", () => {
  it("returns the full rest time for a set logged this instant", () => {
    expect(restSecondsRemaining(logged, logged, REST)).toBe(REST);
  });

  it("counts down from the moment the set was logged", () => {
    expect(restSecondsRemaining(logged, logged + HALF_MINUTE_MS, REST)).toBe(
      REST_LEFT_AFTER_HALF_MINUTE,
    );
  });

  it("returns null once the rest window has passed, so a reload does not restart it", () => {
    expect(restSecondsRemaining(logged, logged + REST_MS, REST)).toBeNull();
    expect(restSecondsRemaining(logged, logged + HOUR_MS, REST)).toBeNull();
  });

  it("clamps a set stamped slightly in the future (clock skew) to the full rest time", () => {
    expect(restSecondsRemaining(logged + SKEW_MS, logged, REST)).toBe(REST);
  });

  it("returns null for an unparseable timestamp or a zero rest time", () => {
    expect(restSecondsRemaining(Number.NaN, logged, REST)).toBeNull();
    expect(restSecondsRemaining(logged, logged, 0)).toBeNull();
  });
});

describe("latestLoggedAt", () => {
  it("returns the newest time whatever the order of the sets", () => {
    const early = new Date(logged);
    const late = new Date(logged + HALF_MINUTE_MS);
    expect(latestLoggedAt([{ loggedAt: late }, { loggedAt: early }])).toEqual(
      late,
    );
    expect(latestLoggedAt([{ loggedAt: early }])).toEqual(early);
  });
});
