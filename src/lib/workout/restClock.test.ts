// Tests for the rest timer's end-time math (D34): the countdown is a deadline, so a throttled
// or sleeping tab cannot slow it, and +15 / -15 move the deadline.
import { describe, expect, it } from "vitest";
import {
  ADJUST_SECONDS,
  adjustRestEnd,
  restEndFromRemaining,
  restSecondsLeft,
} from "./restClock";

const NOW = Date.parse("2026-11-25T15:00:00.000Z");
const SECOND_MS = 1000;
const TWO = 2;
const ONE_AND_HALF_S = 1500;
const FIVE_S = 5000;
const TEN_S = 10_000;
const THIRTY_S = 30_000;
const SIXTY_S = 60_000;
const NINETY_S = 90_000;
const EIGHTY = 80;
const LEFT_AFTER_SLEEP = 30;
const THIRTY_PLUS = 45_000;
const THIRTY_MINUS = 15_000;

describe("restSecondsLeft", () => {
  it("rounds up, so the display reads 00:01 until the very end", () => {
    expect(restSecondsLeft(NOW + ONE_AND_HALF_S, NOW)).toBe(TWO);
    expect(restSecondsLeft(NOW + 1, NOW)).toBe(1);
  });

  it("is zero at and after the end time", () => {
    expect(restSecondsLeft(NOW, NOW)).toBe(0);
    expect(restSecondsLeft(NOW - FIVE_S, NOW)).toBe(0);
  });

  it("is still right after the page slept for a minute (no per-second ticks needed)", () => {
    expect(restSecondsLeft(NOW + NINETY_S, NOW + SIXTY_S)).toBe(
      LEFT_AFTER_SLEEP,
    );
  });
});

describe("restEndFromRemaining", () => {
  it("puts the end time that many seconds ahead", () => {
    expect(restEndFromRemaining(EIGHTY, NOW)).toBe(NOW + EIGHTY * SECOND_MS);
  });
});

describe("adjustRestEnd", () => {
  it("adds 15 seconds", () => {
    expect(adjustRestEnd(NOW + THIRTY_S, ADJUST_SECONDS, NOW)).toBe(
      NOW + THIRTY_PLUS,
    );
  });

  it("removes 15 seconds", () => {
    expect(adjustRestEnd(NOW + THIRTY_S, -ADJUST_SECONDS, NOW)).toBe(
      NOW + THIRTY_MINUS,
    );
  });

  it("never moves the end before now", () => {
    expect(adjustRestEnd(NOW + TEN_S, -ADJUST_SECONDS, NOW)).toBe(NOW);
  });

  it("the step is 15 seconds", () => {
    expect(ADJUST_SECONDS * SECOND_MS).toBe(THIRTY_MINUS);
  });
});
