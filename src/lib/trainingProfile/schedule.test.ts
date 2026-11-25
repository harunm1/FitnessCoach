import { describe, expect, it } from "vitest";
import { NOW, daysAgo, weeklyStarts } from "./fixtures";
import {
  activeWeeks,
  monthsBetween,
  usualHour,
  workoutsPerWeek,
} from "./schedule";

describe("workoutsPerWeek (last 8 weeks)", () => {
  it("is the count in the last 56 days over 8", () => {
    // Monday, Wednesday and Friday for 8 weeks: 24 workouts, minus none after today.
    const starts = weeklyStarts(8, [1, 3, 5], 18);
    const inWindow = starts.filter((s) => s > daysAgo(56)).length;
    expect(workoutsPerWeek(starts, NOW)).toBe(
      Math.round((inWindow / 8) * 10) / 10,
    );
  });

  it("ignores workouts older than 8 weeks", () => {
    expect(workoutsPerWeek([daysAgo(57), daysAgo(100)], NOW)).toBe(0);
  });

  it("rounds to one decimal", () => {
    expect(
      workoutsPerWeek(
        Array.from({ length: 19 }, (_, i) => daysAgo(i * 2 + 1)),
        NOW,
      ),
    ).toBe(2.4);
  });

  it("is 0 for no workouts", () => {
    expect(workoutsPerWeek([], NOW)).toBe(0);
  });
});

describe("usualHour", () => {
  it("is the median start hour in the given zone", () => {
    const starts = weeklyStarts(8, [1, 3, 5], 18);
    expect(usualHour(starts, NOW, "UTC")).toBe(18);
  });

  it("is not moved by one odd session", () => {
    const starts = [...weeklyStarts(4, [1, 3, 5], 18), daysAgo(2)];
    // daysAgo(2) is 17:00 UTC; the median stays at 18.
    expect(usualHour(starts, NOW, "UTC")).toBe(18);
  });

  it("reads the hour in the app's zone: 23:00 UTC in November is 6 pm in Toronto", () => {
    // Three weeks, all after clocks went back on 1 November (UTC-5).
    const starts = weeklyStarts(3, [1, 3, 5], 23);
    expect(usualHour(starts, NOW, "America/Toronto")).toBe(18);
  });

  it("is null with fewer than 3 workouts in the last 8 weeks", () => {
    expect(usualHour([daysAgo(2), daysAgo(5)], NOW, "UTC")).toBeNull();
  });
});

describe("activeWeeks", () => {
  it("counts the distinct weeks with a workout in the last N weeks", () => {
    const starts = [
      daysAgo(1),
      daysAgo(2),
      daysAgo(9),
      daysAgo(40),
      daysAgo(300),
    ];
    expect(activeWeeks(starts, NOW, 26)).toBe(3);
  });
});

describe("monthsBetween", () => {
  it("counts whole months from the first workout", () => {
    expect(monthsBetween(new Date("2026-05-25T12:00:00Z"), NOW)).toBe(6);
    expect(monthsBetween(new Date("2026-05-26T12:00:00Z"), NOW)).toBe(5);
  });

  it("is 0 for a first workout in the future of now", () => {
    expect(monthsBetween(new Date("2026-12-01T00:00:00Z"), NOW)).toBe(0);
  });
});
