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
        [
          ...Array.from({ length: 19 }, (_, i) => daysAgo(i * 2 + 1)),
          daysAgo(100),
        ],
        NOW,
      ),
    ).toBe(2.4);
  });

  it("is 0 for no workouts", () => {
    expect(workoutsPerWeek([], NOW)).toBe(0);
  });

  it("divides by the weeks since the first workout for a new user", () => {
    // Three workouts in the first two weeks: 1.5 a week, not 3 / 8.
    const starts = [daysAgo(13), daysAgo(9), daysAgo(2)];
    expect(workoutsPerWeek(starts, NOW)).toBe(1.5);
  });
});

describe("usualHour across midnight", () => {
  it("is not pulled to midday by workouts around midnight", () => {
    // 23:00, 23:30, 00:30 and 00:45 UTC.
    const starts = [
      new Date("2026-11-20T23:00:00Z"),
      new Date("2026-11-21T23:30:00Z"),
      new Date("2026-11-23T00:30:00Z"),
      new Date("2026-11-24T00:45:00Z"),
    ];
    const hour = usualHour(starts, NOW, "UTC");
    expect([23, 0]).toContain(hour);
  });
});

describe("monthsBetween in Toronto", () => {
  it("uses the Toronto date: 22:00 on 25 May is not 26 May", () => {
    expect(monthsBetween(new Date("2026-05-26T02:00:00Z"), NOW)).toBe(6);
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
