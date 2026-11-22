import { describe, expect, it } from "vitest";
import { dayKey } from "../../src/lib/progress/dates";
import {
  demoSchedule,
  expectedStreaks,
  torontoTime,
  type DemoWorkout,
} from "./schedule";

// Thursday 12 November 2026, midday in Toronto.
const NOW = new Date("2026-11-12T17:00:00Z");
const startOf = (w: DemoWorkout) => torontoTime(w.day, w.hour, w.minute);

describe("demoSchedule", () => {
  const schedule = demoSchedule(NOW);

  it("gives a 7-week active streak and a 4-week goal streak", () => {
    expect(expectedStreaks(NOW)).toEqual({ activeWeeks: 7, goalWeeks: 4 });
  });

  it("includes every kind of workout the page handles", () => {
    expect(new Set(schedule.map((w) => w.kind))).toEqual(
      new Set(["upper", "lower", "power", "free", "stretch", "cardio", "run"]),
    );
    expect(schedule.some((w) => !w.withPlan)).toBe(true);
    expect(schedule.some((w) => !w.finished)).toBe(true);
  });

  it("has a late-evening workout that is already the next day in UTC", () => {
    const late = schedule.filter(
      (w) => startOf(w).toISOString().slice(0, 10) !== w.day,
    );
    expect(late.length).toBeGreaterThan(0);
    for (const w of late) expect(dayKey(startOf(w))).toBe(w.day);
  });

  it("has a day with two workouts", () => {
    const days = schedule.filter((w) => w.finished).map((w) => w.day);
    expect(new Set(days).size).toBeLessThan(days.length);
  });

  it("spans at least three months for the calendar arrows", () => {
    expect(
      new Set(schedule.map((w) => w.day.slice(0, 7))).size,
    ).toBeGreaterThanOrEqual(3);
  });

  it("gives runs a distance and time, and nothing else one", () => {
    for (const w of schedule) {
      expect(w.run !== undefined).toBe(w.kind === "run");
    }
  });

  it("never starts a workout in the future and keeps them in order", () => {
    const times = schedule.map((w) => startOf(w).getTime());
    expect(Math.max(...times)).toBeLessThanOrEqual(NOW.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("leaves out this week's workout if it hasn't happened yet", () => {
    // Monday 9 November, 7 a.m. in Toronto: the 8 a.m. workout is still ahead.
    const early = new Date("2026-11-09T12:00:00Z");
    expect(demoSchedule(early).some((w) => w.weeksAgo === 0)).toBe(false);
  });
});

describe("torontoTime", () => {
  it("uses standard time in November and daylight time in October", () => {
    expect(torontoTime("2026-11-02", 12, 0).toISOString()).toBe(
      "2026-11-02T17:00:00.000Z",
    );
    expect(torontoTime("2026-10-19", 12, 0).toISOString()).toBe(
      "2026-10-19T16:00:00.000Z",
    );
  });
});
